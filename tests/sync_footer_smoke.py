"""Smoke test for the web UI or an HTTP preview of extension/newtab.html."""
import argparse
import json
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:4173/')
parser.add_argument('--extension', action='store_true')
args = parser.parse_args()

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1280, 'height': 900})
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(args.url, wait_until='domcontentloaded')
    page.wait_for_function("document.querySelector('#chromeFoot')?.dataset.toggleReady === 'true'")
    if args.extension:
        page.wait_for_function('!!window.NovaExtensionSync')
        page.locator('#railSync').click()
        assert page.locator('#nesAuthForm').is_visible()
        page.locator('[data-nes-close]').click()
    else:
        page.wait_for_function("!!document.querySelector('#railAccount')?.onclick")
        page.locator('#railAccount').click()
        assert page.locator('#syncLogin').is_visible()
        assert page.locator('#syncSignup').is_visible()
        page.locator('#closeSync').click()
    page.locator('#engine').select_option(label='Google')
    assert page.locator('#engineMark').inner_text() == 'G'
    assert page.locator('#engine').evaluate('(el) => el.getBoundingClientRect().width') >= 90
    page.locator('#footerToggle').click()
    assert page.locator('#footerRestore').is_visible()
    page.reload(wait_until='domcontentloaded')
    page.wait_for_function("document.querySelector('#chromeFoot')?.dataset.toggleReady === 'true'")
    assert page.locator('#engineMark').inner_text() == 'G', 'saved engine icon must restore on reload'
    assert page.locator('#chromeFoot').evaluate('(el) => el.hidden')
    page.locator('#footerRestore').click()
    assert page.locator('#chromeFoot').is_visible()
    page.set_viewport_size({'width': 390, 'height': 844})
    assert page.locator('#railSync' if args.extension else '#railAccount').is_visible()
    assert not errors, json.dumps(errors, ensure_ascii=False)
    browser.close()
print('PASS: login entry, complete engine label, persisted engine icon, footer hide/restore, narrow viewport')
