// open/close shop, shop
document.getElementById('open-shop').addEventListener('click', (e) => {
    e.preventDefault();
    document.body.classList.add('shop-open');
    document.getElementById('shop').classList.add('active');
});

document.getElementById('close-shop').addEventListener('click', () => {
    document.body.classList.remove('shop-open');
    document.getElementById('shop').classList.remove('active');
});
  