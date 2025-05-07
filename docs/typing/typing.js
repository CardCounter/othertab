const input = document.getElementById('real-input');
const typedText = document.getElementById('typed-text');

input.addEventListener('input', () => {
    // typedText.textContent = input.value;
    typedText.textContent = input.value.replace(/ /g, '\u00A0');
    input.scrollTop = input.scrollHeight;
});