import argparse, json
from playwright.sync_api import sync_playwright

parser=argparse.ArgumentParser()
parser.add_argument('--url',default='http://127.0.0.1:5173/')
parser.add_argument('--screenshot',default='/tmp/suishun-context-menu-mobile.png')
args=parser.parse_args()
fixture={
  'bookmarks':[
    {'name':'Alpha','url':'https://alpha.example/','category':'工具','home':True,'icon':'A'},
    {'name':'Beta','url':'https://beta.example/','category':'开发','home':False,'icon':'B'}
  ],
  'categories':[{'name':'工具','icon':'🧰'},{'name':'开发','icon':'⌘'}],
  'defaultSitesFolderMigrationV4':True,
  'defaultHomepageMigrationV1':True
}
state_script="localStorage.setItem('ziyou.replica.v1', " + json.dumps(json.dumps(fixture,ensure_ascii=False)) + ");"
def labels(page):
    return page.locator('.bookmark-label').all_text_contents()
def seed(context):
    context.add_init_script(state_script)
def assert_state(page, predicate, message):
    ok=page.evaluate(f"s => ({predicate})", page.evaluate("window.NovaApp.getState()"))
    assert ok, message

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    desktop=browser.new_context(viewport={'width':1280,'height':900})
    seed(desktop)
    page=desktop.new_page()
    page.route('https://www.google.com/s2/favicons**',lambda route:route.fulfill(status=204,body=''))
    page.goto(args.url,wait_until='domcontentloaded')
    page.wait_for_selector('.bookmark-link')
    assert labels(page)==['Alpha'],f"homepage must only show explicitly selected bookmarks: {labels(page)}"
    assert page.locator('.bookmark-actions').count()==0,'bookmark actions must not be persistently visible'
    card=page.locator('.bookmark').filter(has_text='Alpha').locator('.bookmark-link')
    card.click(button='right')
    menu=page.locator('#bookmarkContextMenu')
    assert menu.get_attribute('aria-hidden')=='false','desktop right-click menu did not open'
    for text in ['编辑标签','移动至分类','布局','删除标签']:
        assert text in menu.inner_text(),f'missing context action: {text}'
    assert '从首页移出' in menu.inner_text() and '加入Dock栏' in menu.inner_text()
    menu.locator('button[data-layout="2x2"]').click()
    assert page.locator('.bookmark[data-layout="2x2"]').count()==1,'layout action did not change the tile'
    card=page.locator('.bookmark-link').first
    card.click(button='right')
    menu.locator('[data-move-category="开发"]').click()
    assert_state(page,"s.bookmarks[0].category==='开发' && s.bookmarks[0].home===true && s.bookmarks[0].layout==='2x2'",'moving category must preserve homepage membership and layout')
    card=page.locator('.bookmark-link').first
    card.click(button='right')
    menu.locator('[data-context-action="dock"]').click()
    assert page.locator('.dock-bookmark').count()==1,'Dock action did not render the pinned bookmark'
    page.locator('.dock-bookmark').click(button='right')
    assert menu.get_attribute('aria-hidden')=='false','Dock bookmark did not expose its context menu'
    menu.locator('[data-context-action="dock"]').click()
    assert page.locator('.dock-bookmark').count()==0,'Dock removal did not take effect'
    page.locator('.bookmark-link').first.click(button='right')
    menu.locator('[data-context-action="edit"]').click()
    page.locator('#bookmarkName').fill('Alpha Edited')
    page.locator('#bookmarkForm button[type="submit"]').click()
    assert labels(page)==['Alpha Edited'],'edit did not update the visible bookmark'
    assert_state(page,"s.bookmarks[0].home===true && s.bookmarks[0].category==='开发'",'edit must preserve homepage and category state')
    page.locator('.bookmark-link').first.click(button='right')
    menu.locator('[data-context-action="home"]').click()
    assert page.locator('.bookmark').count()==0,'removing from homepage did not hide the item'
    assert '首页只显示你主动添加的书签' in page.locator('.empty-state').inner_text()
    page.locator('.rail-category-link[data-cat="开发"]').click()
    assert set(labels(page))=={'Alpha Edited','Beta'},'folder view should retain both categorized bookmarks'
    folder=page.locator('.rail-category-link[data-cat="开发"]')
    folder.click(button='right')
    category_menu=page.locator('#categoryContextMenu')
    assert category_menu.get_attribute('aria-hidden')=='false'
    assert category_menu.locator('.category-context-item').all_text_contents()==['编辑分类','删除'],'folder menu must contain only edit-category and delete'
    page.once('dialog',lambda dialog:dialog.accept())
    page.locator('.bookmark').filter(has_text='Beta').locator('.bookmark-link').click(button='right')
    menu.locator('[data-context-action="delete"]').click()
    assert 'Beta' not in labels(page),'delete action did not remove the bookmark'
    assert_state(page,"s.bookmarks.length===1 && s.bookmarks[0].name==='Alpha Edited' && s.bookmarks[0].home===false && s.bookmarks[0].category==='开发'",'bookmark data changed unexpectedly after menu operations')
    desktop.close()
    print('PASS desktop: right-click, edit, move, layout, Dock add/remove, homepage opt-in, folder menu restrictions, delete, persistence')

    mobile=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
    seed(mobile)
    touch=mobile.new_page()
    touch.route('https://www.google.com/s2/favicons**',lambda route:route.fulfill(status=204,body=''))
    touch.goto(args.url,wait_until='domcontentloaded')
    touch.wait_for_selector('.bookmark-link')
    touch.locator('.rail-category-link[data-cat="开发"]').click()
    touch.wait_for_function("document.querySelectorAll('.bookmark-link').length===1")
    target=touch.locator('.bookmark-link').first
    box=target.bounding_box(); assert box
    x=box['x']+box['width']/2; y=box['y']+box['height']/2
    target.evaluate("(el,p)=>el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerId:31,pointerType:'touch',isPrimary:true,button:0,clientX:p.x,clientY:p.y}))",{'x':x,'y':y})
    touch.wait_for_timeout(100)
    touch.evaluate("p=>document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,cancelable:true,pointerId:31,pointerType:'touch',isPrimary:true,clientX:p.x+30,clientY:p.y}))",{'x':x,'y':y})
    touch.wait_for_timeout(550)
    assert touch.locator('#bookmarkContextMenu').get_attribute('aria-hidden')=='true','moving finger should cancel the long press'
    touch.evaluate("p=>document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,cancelable:true,pointerId:31,pointerType:'touch',isPrimary:true,clientX:p.x+30,clientY:p.y}))",{'x':x,'y':y})
    target=touch.locator('.bookmark-link').first
    box=target.bounding_box(); x=box['x']+box['width']/2; y=box['y']+box['height']/2
    target.evaluate("(el,p)=>el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerId:32,pointerType:'touch',isPrimary:true,button:0,clientX:p.x,clientY:p.y}))",{'x':x,'y':y})
    touch.wait_for_timeout(620)
    assert touch.locator('#bookmarkContextMenu').get_attribute('aria-hidden')=='false','touch long-press did not open the custom bookmark menu'
    touch.evaluate("p=>document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,cancelable:true,pointerId:32,pointerType:'touch',isPrimary:true,clientX:p.x,clientY:p.y}))",{'x':x,'y':y})
    target.dispatch_event('click')
    assert touch.locator('#bookmarkContextMenu').get_attribute('aria-hidden')=='false','long-press release/click closed the menu instead of preserving it'
    touch.screenshot(path=args.screenshot,full_page=False)
    menu=touch.locator('#bookmarkContextMenu')
    assert '移动至分类' in menu.inner_text() and '2x2' in menu.inner_text() and '删除标签' in menu.inner_text()
    menu.locator('[data-context-action="dock"]').click()
    assert touch.locator('.dock-bookmark').count()==1,'touch menu Dock action did not work'
    assert_state(touch,"s.bookmarks[1].dock===true && s.bookmarks[1].home===false",'touch menu must preserve folder membership/homepage rule')
    folder=touch.locator('.rail-category-link[data-cat="开发"]')
    box=folder.bounding_box(); x=box['x']+box['width']/2; y=box['y']+box['height']/2
    folder.evaluate("(el,p)=>el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerId:33,pointerType:'touch',isPrimary:true,button:0,clientX:p.x,clientY:p.y}))",{'x':x,'y':y})
    touch.wait_for_timeout(620)
    assert touch.locator('#categoryContextMenu').get_attribute('aria-hidden')=='false','touch long-press did not open category actions'
    assert touch.locator('#categoryContextMenu .category-context-item').all_text_contents()==['编辑分类','删除'],'touch folder menu must retain the restricted action set'
    touch.evaluate("p=>document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,cancelable:true,pointerId:33,pointerType:'touch',isPrimary:true,clientX:p.x,clientY:p.y}))",{'x':x,'y':y})
    # A real browser touch stream exercises native pointer/contextmenu/click ordering.
    touch.locator('.hero').click(position={'x':5,'y':5})
    target=touch.locator('.bookmark-link').first
    target.scroll_into_view_if_needed()
    box=target.bounding_box(); x=box['x']+box['width']/2; y=box['y']+box['height']/2
    cdp=mobile.new_cdp_session(touch)
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
    touch.wait_for_timeout(700)
    cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    touch.wait_for_function("document.querySelector('#bookmarkContextMenu').classList.contains('open')")
    assert len(mobile.pages)==1,'a long press must not also open the website'
    menu=touch.locator('#bookmarkContextMenu')
    menu.locator('[data-nova-webapp]').click()
    assert_state(touch,"s.bookmarks[1].openMode==='webapp' && s.bookmarks[0].openMode!=='webapp'",'long-press enhanced menu used the wrong bookmark index')
    mobile.close();browser.close()
    print('PASS touch: movement cancels; long-press menu opens, stays open after release, executes Dock action; folder long-press keeps only edit/delete; native CDP touch and enhanced-menu index')
    print('SCREENSHOT '+args.screenshot)
