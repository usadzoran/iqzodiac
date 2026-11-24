(() => {
  'use strict';
  const lang = () => document.documentElement.lang.toLowerCase().startsWith('ar') ? 'ar' : 'en';
  const local = (row, field) => row[`${field}_${lang()}`] || row[`${field}_${lang()==='ar'?'en':'ar'}`] || '';
  const makeLinks = (links) => {
    const ul=document.createElement('ul');
    for(const item of links){const li=document.createElement('li'),a=document.createElement('a');a.textContent=local(item,'label');a.href=item.href;if(/^https:\/\//i.test(item.href)){a.target='_blank';a.rel='noopener noreferrer';}li.append(a);ul.append(li);}
    return ul;
  };
  const render = (menu, links) => {
    const location=menu.location, title=local(menu,'title')||menu.title_en;
    if(location==='footer'){
      const footer=document.querySelector('footer');if(!footer)return;
      let wrap=footer.querySelector('.managed-site-menus');if(!wrap){wrap=document.createElement('nav');wrap.className='managed-site-menus';wrap.setAttribute('aria-label','Site footer menus');footer.prepend(wrap);}
      const group=document.createElement('section');group.className='managed-site-menu';const h=document.createElement('h2');h.textContent=title;group.append(h,makeLinks(links));wrap.append(group);return;
    }
    if(location==='side'){
      let dock=document.querySelector('.managed-side-menu');if(!dock){dock=document.createElement('div');dock.className='managed-side-menu';const toggle=document.createElement('button');toggle.type='button';toggle.className='managed-side-toggle';toggle.setAttribute('aria-expanded','false');toggle.textContent='☰';toggle.setAttribute('aria-label','Open site menu');const panel=document.createElement('aside');panel.className='managed-side-panel';panel.hidden=true;dock.append(toggle,panel);document.body.append(dock);toggle.addEventListener('click',()=>{panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));});}
      const panel=dock.querySelector('.managed-side-panel'),group=document.createElement('section'),h=document.createElement('h2');group.className='managed-site-menu';h.textContent=title;group.append(h,makeLinks(links));panel.append(group);return;
    }
    const host=document.querySelector('.home-nav, .profile-topbar, .site-pages-header-actions, .topbar, header')||document.querySelector('nav');if(!host)return;
    if(location==='header'){
      const nav=document.createElement('nav');nav.className='managed-header-menu';nav.setAttribute('aria-label',title);nav.append(makeLinks(links));host.append(nav);return;
    }
    const details=document.createElement('details');details.className=location==='user'?'managed-user-menu':'managed-dropdown-menu';const summary=document.createElement('summary');summary.textContent=title;details.append(summary,makeLinks(links));host.append(details);
  };
  const boot=async()=>{
    const client=await window.IQZodiacSupabase.ready;
    const [{data:menus,error:menuError},{data:allItems,error:itemError}]=await Promise.all([
      client.from('site_menus').select('id,title_en,title_ar,location,sort_order').eq('is_active',true).order('sort_order').limit(100),
      client.from('site_menu_items').select('menu_id,label_en,label_ar,href,sort_order').eq('is_active',true).order('sort_order').limit(500),
    ]);
    if(menuError||itemError)return;
    for(const menu of menus||[]){const links=(allItems||[]).filter(item=>item.menu_id===menu.id);if(links.length)render(menu,links);}
  };
  const run=()=>void boot().catch(()=>{});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
})();
