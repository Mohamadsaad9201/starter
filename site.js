/* Native disclosure navigation works without JavaScript; these add dismissal. */
(() => {
 const menus=[...document.querySelectorAll('.product-menu, .mobile-menu')];
 document.addEventListener('click',event=>menus.forEach(menu=>{if(!menu.contains(event.target))menu.open=false;}));
 document.addEventListener('keydown',event=>{if(event.key==='Escape')menus.forEach(menu=>{if(menu.open){menu.open=false;menu.querySelector('summary').focus();}});});
})();
