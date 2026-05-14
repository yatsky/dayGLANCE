package com.dayglance.app.billing

import android.app.Activity
import android.content.Context
import android.util.Log
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.QueryPurchasesParams
import com.dayglance.app.data.SharedDataStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/**
 * Manages the Google Play Billing client lifecycle for dayGLANCE subscriptions.
 *
 * Annual plan → Play Console: Monetize → Subscriptions (product type SUBS).
 * Lifetime plan → Play Console: Monetize → In-app products (product type INAPP).
 *
 * Call [connect] from Activity.onStart() and [disconnect] from Activity.onStop().
 * Set [activity] before calling [launchPurchaseFlow].
 */
class BillingManager(
    private val context: Context,
    private val dataStore: SharedDataStore,
) {

    companion object {
        private const val TAG = "DayGlanceBilling"
        // These IDs must match what you create in the Play Console exactly.
        const val PRODUCT_ANNUAL   = "dayglance_pro_annual"
        const val PRODUCT_LIFETIME = "dayglance_pro_lifetime"
        val SUBSCRIPTION_PRODUCTS = listOf(PRODUCT_ANNUAL)
        val INAPP_PRODUCTS        = listOf(PRODUCT_LIFETIME)
        val ALL_PRODUCTS          = SUBSCRIPTION_PRODUCTS + INAPP_PRODUCTS
    }

    var activity: Activity? = null

    /** Called once after the first queryPurchases() completes. Used to signal the splash screen. */
    var onPurchasesQueried: (() -> Unit)? = null

    private val scope = CoroutineScope(Dispatchers.IO)

    private val purchasesUpdatedListener = PurchasesUpdatedListener { result, purchases ->
        // DIAG: log every billing result so we can see exactly what Play returns
        Log.d(TAG, "purchasesUpdatedListener: code=${result.responseCode} msg='${result.debugMessage}' purchases=${purchases?.size ?: "null"}")
        if (result.responseCode == BillingClient.BillingResponseCode.OK && purchases != null) {
            for (purchase in purchases) handlePurchase(purchase)
        }
    }

    private val billingClient: BillingClient = BillingClient.newBuilder(context)
        .setListener(purchasesUpdatedListener)
        .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
        .build()

    fun connect() {
        billingClient.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                    queryPurchases()
                    queryProductPrices()
                }
            }
            override fun onBillingServiceDisconnected() {
                // Play will retry automatically; we reconnect on next connect() call.
            }
        })
    }

    /**
     * Fetches prices for all products and caches them in SharedPreferences.
     *
     * Annual (SUBS): filters for the INFINITE_RECURRING phase (recurrenceMode 1).
     * Lifetime (INAPP): reads oneTimePurchaseOfferDetails.formattedPrice directly.
     */
    fun queryProductPrices() {
        if (!billingClient.isReady) return

        val subsParams = QueryProductDetailsParams.newBuilder()
            .setProductList(SUBSCRIPTION_PRODUCTS.map { id ->
                QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(id)
                    .setProductType(BillingClient.ProductType.SUBS)
                    .build()
            })
            .build()

        val inappParams = QueryProductDetailsParams.newBuilder()
            .setProductList(INAPP_PRODUCTS.map { id ->
                QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(id)
                    .setProductType(BillingClient.ProductType.INAPP)
                    .build()
            })
            .build()

        scope.launch {
            billingClient.queryProductDetailsAsync(subsParams) { result, detailsList ->
                if (result.responseCode != BillingClient.BillingResponseCode.OK) return@queryProductDetailsAsync
                for (details in detailsList) {
                    val price = details.subscriptionOfferDetails
                        ?.flatMap { it.pricingPhases.pricingPhaseList }
                        ?.firstOrNull { it.recurrenceMode == 1 }
                        ?.formattedPrice ?: continue
                    if (details.productId == PRODUCT_ANNUAL) dataStore.productPriceAnnual = price
                }
            }
            billingClient.queryProductDetailsAsync(inappParams) { result, detailsList ->
                if (result.responseCode != BillingClient.BillingResponseCode.OK) return@queryProductDetailsAsync
                for (details in detailsList) {
                    val price = details.oneTimePurchaseOfferDetails?.formattedPrice ?: continue
                    if (details.productId == PRODUCT_LIFETIME) dataStore.productPriceLifetime = price
                }
            }
        }
    }

    fun disconnect() {
        billingClient.endConnection()
    }

    private suspend fun queryPurchasesForType(productType: String): List<Purchase> =
        suspendCancellableCoroutine { cont ->
            billingClient.queryPurchasesAsync(
                QueryPurchasesParams.newBuilder().setProductType(productType).build()
            ) { _, purchases -> cont.resume(purchases) }
        }

    fun queryPurchases() {
        if (!billingClient.isReady) return
        scope.launch {
            val activeSub = queryPurchasesForType(BillingClient.ProductType.SUBS)
                .firstOrNull { it.purchaseState == Purchase.PurchaseState.PURCHASED }

            val active = activeSub ?: queryPurchasesForType(BillingClient.ProductType.INAPP)
                .firstOrNull { it.purchaseState == Purchase.PurchaseState.PURCHASED }

            if (active != null) {
                if (!active.isAcknowledged) acknowledgePurchase(active)
                dataStore.subscriptionActive = true
                dataStore.subscriptionProductId = active.products.firstOrNull()
                dataStore.subscriptionToken = active.purchaseToken
            } else {
                dataStore.subscriptionActive = false
                dataStore.subscriptionProductId = null
                dataStore.subscriptionToken = null
            }
            onPurchasesQueried?.invoke()
            onPurchasesQueried = null
        }
    }

    /**
     * Launches the Google Play purchase sheet for [productId].
     * Routes to SUBS or INAPP depending on the product. Must be called with
     * [activity] set; the billing flow is dispatched to the main thread.
     */
    fun launchPurchaseFlow(productId: String) {
        val act = activity ?: run {
            Log.w(TAG, "launchPurchaseFlow($productId): activity is null, aborting")
            return
        }
        if (!billingClient.isReady) {
            Log.w(TAG, "launchPurchaseFlow($productId): billingClient not ready, aborting")
            return
        }

        val productType = if (productId in INAPP_PRODUCTS) BillingClient.ProductType.INAPP
                          else BillingClient.ProductType.SUBS

        Log.d(TAG, "launchPurchaseFlow($productId): starting — type=$productType ts=${System.currentTimeMillis()}")

        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(listOf(
                QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(productId)
                    .setProductType(productType)
                    .build()
            ))
            .build()

        scope.launch {
            billingClient.queryProductDetailsAsync(params) { result, detailsList ->
                Log.d(TAG, "launchPurchaseFlow($productId): queryProductDetailsAsync code=${result.responseCode} msg='${result.debugMessage}' count=${detailsList.size} ts=${System.currentTimeMillis()}")

                if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                    Log.w(TAG, "launchPurchaseFlow($productId): query failed, silent exit A (code=${result.responseCode})")
                    return@queryProductDetailsAsync
                }
                val details = detailsList.firstOrNull() ?: run {
                    Log.w(TAG, "launchPurchaseFlow($productId): empty detailsList, silent exit B")
                    return@queryProductDetailsAsync
                }

                // DIAG: dump full ProductDetails for this product
                Log.d(TAG, "  ProductDetails: id=${details.productId} type=${details.productType} title='${details.title}'")
                details.subscriptionOfferDetails?.forEachIndexed { i, offer ->
                    Log.d(TAG, "  offerDetails[$i]: basePlanId='${offer.basePlanId}' offerId='${offer.offerId}' offerToken='${offer.offerToken.take(20)}...' tags=${offer.offerTags}")
                } ?: Log.w(TAG, "  subscriptionOfferDetails=null (INAPP or missing)")

                val productDetailsParams = BillingFlowParams.ProductDetailsParams.newBuilder()
                    .setProductDetails(details)
                    .apply {
                        if (productType == BillingClient.ProductType.SUBS) {
                            val offerToken = details.subscriptionOfferDetails?.firstOrNull()?.offerToken
                                ?: run {
                                    Log.w(TAG, "launchPurchaseFlow($productId): no offerToken, silent exit C")
                                    return@queryProductDetailsAsync
                                }
                            Log.d(TAG, "  using offerToken from index 0: '${offerToken.take(20)}...'")
                            setOfferToken(offerToken)
                        }
                    }
                    .build()

                val flowParams = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(listOf(productDetailsParams))
                    .build()

                act.runOnUiThread {
                    val launchResult = billingClient.launchBillingFlow(act, flowParams)
                    Log.d(TAG, "launchPurchaseFlow($productId): launchBillingFlow returned code=${launchResult.responseCode} msg='${launchResult.debugMessage}' ts=${System.currentTimeMillis()}")
                }
            }
        }
    }

    private fun handlePurchase(purchase: Purchase) {
        if (purchase.purchaseState != Purchase.PurchaseState.PURCHASED) return
        if (!purchase.isAcknowledged) acknowledgePurchase(purchase)
        dataStore.subscriptionActive = true
        dataStore.subscriptionProductId = purchase.products.firstOrNull()
        dataStore.subscriptionToken = purchase.purchaseToken
    }

    private fun acknowledgePurchase(purchase: Purchase) {
        val params = AcknowledgePurchaseParams.newBuilder()
            .setPurchaseToken(purchase.purchaseToken)
            .build()
        billingClient.acknowledgePurchase(params) { /* fire and forget */ }
    }
}
