// const input = document.getElementById('real-input');
const typedText = document.getElementById('typed-text');

// input.addEventListener('input', () => {
//     typedText.textContent = input.value;
//     input.scrollTop = input.scrollHeight;
// });

const userTyped = [];

document.addEventListener('keydown', (e) => {
    if (/^[a-zA-Z0-9 !"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]$/.test(e.key)) {
        userTyped.push(e.key);
    } 
    else if (e.key === 'Backspace') {
        userTyped.pop();
    }
    // else if (e.key === 'Enter') {
    //     resetBoard();
    // }

    typedText.textContent = userTyped.join('') + "|";
});