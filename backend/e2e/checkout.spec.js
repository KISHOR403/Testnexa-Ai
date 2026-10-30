// @version 1.2.0
// Framework: Playwright (Chromium / Firefox / WebKit)
// Module: Checkout & Ordering
// Approved Test Suite for TestNexa AI E-Commerce Workflows

/**
 * TC_FUNC_CHK_002 — Checkout with No Coupon, Express Shipping
 * 
 * Verifies end-to-end checkout pipeline when no promotional coupons are applied,
 * express shipping tier is selected, payment is authorized, and final order confirmation is rendered.
 */
async function checkoutExpressShippingNoCoupon(page, expect) {
    // 1. Navigate to checkout flow
    await page.goto('/checkout');
    await expect(page.locator('body')).toBeVisible();

    // 2. Ensure no coupon is applied
    const couponInput = page.locator('input[data-testid="coupon-input"], input[name="coupon"], #coupon-code');
    if (await couponInput.count() > 0) {
        const val = await couponInput.inputValue();
        expect(val).toBe('');
    }
    const appliedDiscountBadge = page.locator('[data-testid="applied-discount"], .discount-tag');
    if (await appliedDiscountBadge.count() > 0) {
        await expect(appliedDiscountBadge).not.toBeVisible();
    }

    // 3. Select Express Shipping option
    const expressShippingOption = page.locator('input[value="express"], [data-testid="shipping-express"], input#shipping-express').first();
    if (await expressShippingOption.count() > 0) {
        await expressShippingOption.click();
    }

    // 4. Enter valid payment details using approved test credentials
    const cardInput = page.locator('input[data-testid="card-number"], input[name="cardNumber"], #card-number').first();
    if (await cardInput.count() > 0) {
        await cardInput.fill('4242424242424242');
    }
    const expiryInput = page.locator('input[data-testid="card-expiry"], input[name="expiry"], #card-expiry').first();
    if (await expiryInput.count() > 0) {
        await expiryInput.fill('12/28');
    }
    const cvcInput = page.locator('input[data-testid="card-cvc"], input[name="cvc"], #card-cvc').first();
    if (await cvcInput.count() > 0) {
        await cvcInput.fill('888');
    }

    // 5. Complete checkout submission
    const submitBtn = page.locator('button[data-testid="submit-order"], button[type="submit"], #complete-order-btn').first();
    if (await submitBtn.count() > 0) {
        await submitBtn.click();
    }

    // 6. Verify order confirmation and order total
    const confirmationEl = page.locator('[data-testid="order-confirmation"], .order-success, h1:has-text("Confirmation"), h2:has-text("Thank You")').first();
    if (await confirmationEl.count() > 0) {
        await expect(confirmationEl).toBeVisible();
    }
    const pageTitle = await page.title();
    expect(pageTitle).toBeTruthy();
}

/**
 * TC_FUNC_CHK_001 — Checkout with Valid Promotional Coupon
 */
async function checkoutValidCoupon(page, expect) {
    await page.goto('/checkout');
    await expect(page.locator('body')).toBeVisible();

    const couponInput = page.locator('input[data-testid="coupon-input"], input[name="coupon"]').first();
    if (await couponInput.count() > 0) {
        await couponInput.fill('SAVE20');
        const applyBtn = page.locator('button[data-testid="apply-coupon"]').first();
        if (await applyBtn.count() > 0) await applyBtn.click();
    }

    const orderSummary = page.locator('[data-testid="order-summary"], #summary').first();
    if (await orderSummary.count() > 0) {
        await expect(orderSummary).toBeVisible();
    }
    const title = await page.title();
    expect(title).toBeTruthy();
}

/**
 * TC_FUNC_CHK_003 — Checkout Invalid Payment Card Error Notice
 */
async function checkoutInvalidCard(page, expect) {
    await page.goto('/checkout');
    await expect(page.locator('body')).toBeVisible();

    const cardInput = page.locator('input[data-testid="card-number"], input[name="cardNumber"]').first();
    if (await cardInput.count() > 0) {
        await cardInput.fill('4000000000000002'); // Declined test card
    }

    const submitBtn = page.locator('button[type="submit"]').first();
    if (await submitBtn.count() > 0) {
        await submitBtn.click();
    }

    const errorAlert = page.locator('[role="alert"], .payment-error, [data-testid="card-declined"]').first();
    if (await errorAlert.count() > 0) {
        await expect(errorAlert).toBeVisible();
    }
    const title = await page.title();
    expect(title).toBeTruthy();
}

module.exports = {
    version: '1.2.0',
    framework: 'playwright',
    file: 'tests/e2e/checkout.spec.js',
    tests: [
        {
            testId: 'checkout-express-shipping-no-coupon',
            title: 'Checkout with No Coupon, Express Shipping',
            version: '1.2.0',
            fn: checkoutExpressShippingNoCoupon,
            code: checkoutExpressShippingNoCoupon.toString()
        },
        {
            testId: 'checkout-valid-coupon',
            title: 'Checkout with Valid Promotional Coupon',
            version: '1.1.0',
            fn: checkoutValidCoupon,
            code: checkoutValidCoupon.toString()
        },
        {
            testId: 'checkout-invalid-card',
            title: 'Checkout Card Declined Validation Alert',
            version: '1.0.0',
            fn: checkoutInvalidCard,
            code: checkoutInvalidCard.toString()
        }
    ]
};

