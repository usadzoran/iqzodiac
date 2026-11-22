(() => {
  'use strict';
  const boot = async () => {
    const client = await window.IQZodiacSupabase.ready;
    const { data, error } = await client.from('site_menus').select('id,title_en,title_ar,sort_order').eq('is_active',true).eq('location','footer').order('sort_order').limit(50);
    if(error || !data?.length) return;
    const { data: items } = await client.from('site_menu_items').select('menu_id,label_en,label_ar,href,sort_order').eq('is_active',true).order('sort_order').limit(500);
    const language = document.documentElement.lang.toLowerCase().startsWith('ar') ? 'ar' : 'en';
    document.querySelectorAll('footer').forEach(footer => {
      if(footer.querySelector('.managed-site-menus')) return;
      const wrap=document.createElement('nav'); wrap.className='managed-site-menus'; wrap.setAttribute('aria-label',language==='ar'?'قوائم الموقع':'Site menus');
      for(const menu of data){const links=(items||[]).filter(i=>i.menu_id===menu.id);if(!links.length)continue;const section=document.createElement('section');section.className='managed-site-menu';const title=document.createElement('h2');title.textContent=menu[`title_${language}`]||menu.title_en;section.append(title);const list=document.createElement('ul');for(const item of links){const li=document.createElement('li'),a=document.createElement('a');a.textContent=item[`label_${language}`]||item.label_en;a.href=item.href;if(/^https:\/\//i.test(item.href)){a.rel='noopener noreferrer';}li.append(a);list.append(li);}section.append(list);wrap.append(section);}
      if(wrap.childElementCount)footer.prepend(wrap);
    });
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>void boot().catch(()=>{}),{once:true});else void boot().catch(()=>{});
})();
