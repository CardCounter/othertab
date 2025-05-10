// // const input = document.getElementById('real-input');
// const typedText = document.getElementById('typed-text');
// const placeholder = document.getElementById('placeholder');
// // placeholder.textContent = 

// const words = placeholder.textContent.trim().split(' ');
// const lastWord = words.pop();
// const frontWords = words.map(word => `<span class="wrap-word">${word} </span>`).join('');
// const fullWords = frontWords + `<span class="wrap-word">${lastWord}</span>`;

// placeholder.innerHTML = fullWords;

// const spans = Array.from(placeholder.querySelectorAll('.wrap-word'));

// for (const span of spans) console.log(span, span.getBoundingClientRect());


// const userTyped = [];





// const spans = Array.from(placeholder.querySelectorAll('.wrap-word'));
// let lines = [];
// let currentLineTop = null;
// let currentLine = [];

// for (const span of spans) {
//     const rect = span.getBoundingClientRect();

import { words_none } from './words/1k.js';

class Typing {
    constructor(){
        // constants
        this.words = words_none; 
        this.wordsLength = this.words.length - 1;

        // vars
        this.masterString = '';
        this.masterArray = [];
        this.masterArrayLength = 0;
        this.displayArray = [];
        this.characterArray = [];
        this.userTyped = [];
        this.currentIndex = -1;

        this.firstKey = false; ///// add to reset
        this.boardAllCorrect = false;
        this.typingDone = false;
        this.canType = true;

        this.currentWordMode = 'mode-50'
        document.getElementById(this.currentWordMode).classList.add('active');
        this.numWords = document.getElementById(this.currentWordMode).dataset.time;

        console.log(`${this.numWords}`)

        this.initializeBoard(this.numWords);

        const wordButtons = document.querySelectorAll('.mode-button');
        wordButtons.forEach(button => {
            button.addEventListener('click', () => {
                // reset all to active state
                wordButtons.forEach(btn => btn.classList.remove('active'));
                
                // add active state for chosen button
                button.classList.add('active');
                
                // set difficulty and reset game
                this.currentWordMode = button.id;
                this.numWords = document.getElementById(this.currentWordMode).dataset.time;
                this.resetBoard(this.numWords);
            });
        });

        document.addEventListener('keydown', (e) => { // need to ad option backspace for pop until space, cmd backspace for pop until new line marker
            if (e.code === 'Space' && document.activeElement.tagName === 'BUTTON') {
                e.preventDefault();
            }
            if (this.canType){
                if (this.userTyped.length < this.masterArrayLength) {
                    console.log('in short case');
                    if (/^[a-zA-Z0-9 !"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]$/.test(e.key)) {
                        if (this.firstKey === false) this.firstKey = true; /// start timer here
    
                        this.userTyped.push(e.key);
                        this.currentIndex++;
                        this.checkCharacterStyle(this.masterArray, this.userTyped, this.currentIndex, this.characterArray);
                        this.moveCaretTo(this.currentIndex);
                    } 
                    else if (e.key === 'Backspace') {
                        this.userTyped.pop();
    
                        if (this.currentIndex > -1){
                            this.removeCharacteraStyle(this.currentIndex, this.characterArray);
                            this.currentIndex--;
                            this.moveCaretTo(this.currentIndex);
                        }
                        else this.currentIndex = -1; // safety
                        this.moveCaretTo(this.currentIndex);
        
                    }
                }
                else{
                    console.log('in long case');
                    this.boardAllCorrect = this.checkAllCorrect();
                    if (this.boardAllCorrect){
                        this.typingDone = true;
                        this.canType = false;
                    }
                    else if (e.key === 'Backspace') {
                        this.userTyped.pop();
    
                        if (this.currentIndex > -1){
                            this.removeCharacteraStyle(this.currentIndex, this.characterArray);
                            this.currentIndex--;
                            this.moveCaretTo(this.currentIndex);
                        }
                        else this.currentIndex = -1; // safety
                        this.moveCaretTo(this.currentIndex);
        
                    }
                }
            }

            if (e.key === 'Enter') {
                e.preventDefault();
                this.resetBoard(this.numWords);
            }
        });   
    }

    initializeBoard(numWords){
        const typedText = document.getElementById('typed-text');

        this.masterString = this.chooseRandomWords(numWords);
        this.masterArray = this.masterString.split('');
        this.masterArrayLength = this.masterArray.length;
        this.displayArray = this.masterArray.map(char => `<span class="character">${char}</span>`);

        typedText.innerHTML = this.displayArray.join('');
        this.characterArray = typedText.querySelectorAll('.character');
        this.moveCaretTo(-1);
    }

    chooseRandomWords(count){
        const newWords = [];
        for (let i = 0; i < count; i++){
            newWords.push(this.words[Math.floor(Math.random() * this.wordsLength)]);
        }
        let wordString = newWords.join(' ');

        return wordString.trim();
    }

    resetBoard(numWords){
        this.masterString = '';
        this.masterArray = [];
        this.masterArrayLength = 0;
        this.displayArray = [];
        this.characterArray = [];
        this.userTyped = [];
        this.currentIndex = -1;

        this.firstKey = false;
        this.boardAllCorrect = false;
        this.typingDone = false;
        this.canType = true;

        this.initializeBoard(numWords);
    }

    checkCharacterStyle(masterArray, userTyped, currentIndex, characterArray){
        if (currentIndex === -1) return;
        else if (userTyped.length - 1 < currentIndex) {
            characterArray[currentIndex].classList.remove('correct');
            characterArray[currentIndex].classList.remove('wrong');
        }
        else if (userTyped[currentIndex] === masterArray[currentIndex]) {
            characterArray[currentIndex].classList.remove('wrong');
            characterArray[currentIndex].classList.add('correct');
        }
        else {
            characterArray[currentIndex].classList.remove('correct');
            characterArray[currentIndex].classList.add('wrong');
        }
    }

    removeCharacteraStyle(currentIndex, characterArray){
        characterArray[currentIndex].classList.remove('correct');
        characterArray[currentIndex].classList.remove('wrong');
    }

    checkAllCorrect(){
        for (let char of this.characterArray){
            if (!char.classList.contains('correct')) return false;
        }
        return true;
    }

    moveCaretTo(index){
        if (index < this.masterArrayLength - 1){
            const typedText = document.getElementById('typed-text');

            const target = typedText.querySelectorAll('.character')[index + 1];
            const caret = document.getElementById('caret');
    
            const textContainerLocation = typedText.getBoundingClientRect();
            const targetLocation = target.getBoundingClientRect();
    
            caret.style.left = (targetLocation.left - textContainerLocation.left) + 'px';
            caret.style.top = (targetLocation.top - textContainerLocation.top) + 'px';
        }
        else{ // moves it off the screen. i guess its ok, if last letter is wrong can backspace and caret will still be there.
            const typedText = document.getElementById('typed-text');

            const target = typedText.querySelectorAll('.character')[index];
            const caret = document.getElementById('caret');
    
            const textContainerLocation = typedText.getBoundingClientRect();
            const targetLocation = target.getBoundingClientRect();
    
            caret.style.left = (targetLocation.right - textContainerLocation.right) + 'px';
            caret.style.top = (targetLocation.top - textContainerLocation.top) + 'px';

            
        }
    }

}

window.addEventListener('DOMContentLoaded', () => {
    document.documentElement.classList.remove('js-loading');
    const typing = new Typing();
});
