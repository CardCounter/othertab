let targetText = "this is a sample text to test the typing game";
let currentInput = "";
let currentIndex = 0;
let typingBox = document.getElementById("typing-box");

function renderText() {
    let html = "";
    const words = targetText.split(" ");
    const typedWords = currentInput.trim().split(" ");
    let charIndex = 0;

    words.forEach((word, wIdx) => {
        let typedWord = typedWords[wIdx] || "";
        let display = "";
        for (let i = 0; i < Math.max(word.length, typedWord.length); i++) {
            let cls = "correct";
            if (i >= word.length) cls = "overtyped";
            else if (i >= typedWord.length) cls = "";
            else if (typedWord[i] !== word[i]) cls = "incorrect";
            display += `<span class="${cls}">${typedWord[i] || word[i] || " "}</span>`;
        }
        if (typedWord !== word && typedWord !== "") {
            display = `<span class="locked-wrong">${display}</span>`;
        }
        html += display + " ";
    });
    // Add blinking cursor
    html += '<span class="cursor">|</span>';
    typingBox.innerHTML = html;
}

document.addEventListener("keydown", (e) => {
    if (e.key === "`") {
        currentInput = "";
        renderText();
        return;
    }
    if (e.key === "Backspace") {
        let parts = currentInput.trimEnd().split(" ");
        if (parts.length === targetText.split(" ").length) return;
        currentInput = currentInput.slice(0, -1);
        renderText();
        return;
    }
    if (e.key.length === 1 || e.key === " ") {
        currentInput += e.key;
        renderText();
    }
});

renderText();

