from playwright.sync_api import sync_playwright
import time

STAGING = "https://carzo-eight-staging.vercel.app"
SCREENSHOTS_DIR = "C:/Users/maxba/Desktop/carzo/test-screenshots"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 390, "height": 844})  # iPhone 14 size

    # 1. Load product page
    print("1. Loading product page...")
    page.goto(f"{STAGING}/case/design/m/2-0")
    page.wait_for_load_state("networkidle")
    page.screenshot(path=f"{SCREENSHOTS_DIR}/01-product-page.png", full_page=True)
    print("   Product page loaded")

    # 2. Click "Купити" button to add to cart
    print("2. Adding to cart...")
    buy_btn = page.locator("text=Купити").first
    if buy_btn.is_visible():
        buy_btn.click()
        page.wait_for_timeout(1000)
        page.screenshot(path=f"{SCREENSHOTS_DIR}/02-cart-opened.png")
        print("   Item added, cart opened")
    else:
        print("   ERROR: Buy button not found")
        # Try alternative selectors
        page.screenshot(path=f"{SCREENSHOTS_DIR}/02-error-no-buy-btn.png")

    # 3. Click "Оформити замовлення" to go to checkout
    print("3. Opening checkout...")
    checkout_btn = page.locator("text=Оформити замовлення").first
    if checkout_btn.is_visible():
        checkout_btn.click()
        page.wait_for_timeout(500)
        page.screenshot(path=f"{SCREENSHOTS_DIR}/03-checkout-opened.png")
        print("   Checkout opened")
    else:
        print("   ERROR: Checkout button not found")
        page.screenshot(path=f"{SCREENSHOTS_DIR}/03-error-no-checkout-btn.png")

    # 4. Check delivery method buttons exist
    print("4. Checking delivery methods...")
    branch_btn = page.locator("text=У відділення").first
    courier_btn = page.locator("text=Кур'єром").first
    postomat_btn = page.locator("text=У поштомат").first
    
    branch_visible = branch_btn.is_visible() if branch_btn.count() > 0 else False
    courier_visible = courier_btn.is_visible() if courier_btn.count() > 0 else False
    postomat_visible = postomat_btn.is_visible() if postomat_btn.count() > 0 else False
    
    print(f"   У відділення: {'VISIBLE' if branch_visible else 'NOT FOUND'}")
    print(f"   Кур'єром: {'VISIBLE' if courier_visible else 'NOT FOUND'}")
    print(f"   У поштомат: {'VISIBLE' if postomat_visible else 'NOT FOUND'}")
    page.screenshot(path=f"{SCREENSHOTS_DIR}/04-delivery-methods.png")

    # 5. Test city search
    print("5. Testing city search...")
    city_input = page.locator("input[placeholder*='місто']").first
    if city_input.is_visible():
        city_input.fill("Дніпро")
        page.wait_for_timeout(1500)  # Wait for debounce + API
        page.screenshot(path=f"{SCREENSHOTS_DIR}/05-city-search.png")
        
        # Click first city result
        city_option = page.locator("[role='option']").first
        if city_option.is_visible():
            city_option.click()
            page.wait_for_timeout(500)
            page.screenshot(path=f"{SCREENSHOTS_DIR}/06-city-selected.png")
            print("   City selected: Дніпро")
        else:
            print("   ERROR: No city results")
    else:
        print("   ERROR: City input not found")

    # 6. Test branch dropdown
    print("6. Testing branch dropdown...")
    branch_dropdown = page.locator("text=Виберіть відділення").first
    if branch_dropdown.is_visible():
        branch_dropdown.click()
        page.wait_for_timeout(1500)  # Wait for API
        page.screenshot(path=f"{SCREENSHOTS_DIR}/07-branch-list.png")
        
        # Check if points loaded
        points = page.locator("[role='option']")
        point_count = points.count()
        print(f"   Branches loaded: {point_count} items")
        
        if point_count > 0:
            first_point = points.first.inner_text()
            print(f"   First branch: {first_point[:60]}")
    else:
        print("   ERROR: Branch dropdown not found")

    # 7. Switch to courier mode
    print("7. Testing courier mode...")
    if courier_btn.count() > 0:
        courier_btn.click()
        page.wait_for_timeout(500)
        page.screenshot(path=f"{SCREENSHOTS_DIR}/08-courier-mode.png")
        
        street_input = page.locator("input[placeholder*='вулицю']").first
        house_visible = page.locator("text=Будинок").first.is_visible()
        apartment_visible = page.locator("text=Квартира").first.is_visible()
        
        print(f"   Street input: {'VISIBLE' if street_input.count() > 0 and street_input.is_visible() else 'NOT FOUND'}")
        print(f"   House field: {'VISIBLE' if house_visible else 'NOT FOUND'}")
        print(f"   Apartment field: {'VISIBLE' if apartment_visible else 'NOT FOUND'}")

    # 8. Switch to postomat mode
    print("8. Testing postomat mode...")
    if postomat_btn.count() > 0 and postomat_btn.is_enabled():
        postomat_btn.click()
        page.wait_for_timeout(500)
        
        postomat_dropdown = page.locator("text=Виберіть поштомат").first
        if postomat_dropdown.is_visible():
            postomat_dropdown.click()
            page.wait_for_timeout(1500)
            page.screenshot(path=f"{SCREENSHOTS_DIR}/09-postomat-list.png")
            
            postomats = page.locator("[role='option']")
            postomat_count = postomats.count()
            print(f"   Postomats loaded: {postomat_count} items")
        else:
            print("   Postomat dropdown not found (may be disabled for this order)")
            page.screenshot(path=f"{SCREENSHOTS_DIR}/09-postomat-disabled.png")
    else:
        print("   Postomat button disabled (expected for multi-item or large orders)")

    # 9. Go back to cart mode and check trust row
    print("9. Checking trust row...")
    page.keyboard.press("Escape")
    page.wait_for_timeout(500)
    
    # Re-open cart
    cart_icon = page.locator("[aria-label*='кошик'], [aria-label*='cart'], button:has(svg)").first
    if cart_icon.is_visible():
        cart_icon.click()
        page.wait_for_timeout(500)
    
    trust_row = page.locator("text=Повернення та обмін")
    trust_visible = trust_row.is_visible() if trust_row.count() > 0 else False
    print(f"   Trust row: {'VISIBLE' if trust_visible else 'NOT FOUND'}")
    page.screenshot(path=f"{SCREENSHOTS_DIR}/10-trust-row.png")

    # 10. Desktop viewport test
    print("10. Desktop viewport test...")
    page.set_viewport_size({"width": 1440, "height": 900})
    page.goto(f"{STAGING}/case/design/m/2-0")
    page.wait_for_load_state("networkidle")
    page.screenshot(path=f"{SCREENSHOTS_DIR}/11-desktop-product.png")
    print("    Desktop page loaded")

    browser.close()
    print("\nDone! Screenshots saved to:", SCREENSHOTS_DIR)
