(() => {
  'use strict';
  const boot = async () => {
    const location = document.body.dataset.siteLocation;
    if (!location) return;
    const client = await window.IQZodiacSupabase.ready;
    const { data, error } = await client.from('site_pages').select('slug,title_en,title_ar,body_en,body_ar,sort_order').eq('content_type','section').eq('display_location',location).eq('is_published',true).order('sort_order').order('title_en').limit(100);
    if (error || !data?.length) return;
    const ar = window.IQZodiacLanguage?.language === 'ar';
    const wrap = document.createElement('section'); wrap.className='managed-site-sections'; wrap.setAttribute('aria-label',ar?'أقسام الموقع':'Website sections');
    for (const row of data) {
      const card=document.createElement('article');card.className='managed-site-section';
      const h=document.createElement('h2');h.textContent=ar?(row.title_ar||row.title_en):(row.title_en||row.title_ar);
      const p=document.createElement('p');p.textContent=ar?(row.body_ar||row.body_en):(row.body_en||row.body_ar);p.dir=ar?'rtl':'ltr';
      card.append(h,p);wrap.append(card);
    }
    const main=document.querySelector('main');if(!main)return;
    const heading=main.querySelector(':scope > header');
    if(heading) heading.after(wrap); else main.prepend(wrap);
    document.addEventListener('iqzodiac:languagechange',()=>{const isAr=window.IQZodiacLanguage?.language==='ar';wrap.setAttribute('aria-label',isAr?'أقسام الموقع':'Website sections');wrap.querySelectorAll('.managed-site-section').forEach((card,i)=>{const row=data[i];card.querySelector('h2').textContent=isAr?(row.title_ar||row.title_en):(row.title_en||row.title_ar);const p=card.querySelector('p');p.textContent=isAr?(row.body_ar||row.body_en):(row.body_en||row.body_ar);p.dir=isAr?'rtl':'ltr';});});
  };
  const run=()=>void boot().catch(error=>console.warn('Site sections unavailable.',error));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
})();
