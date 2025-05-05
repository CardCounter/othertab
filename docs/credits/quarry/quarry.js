if (!localStorage.getItem('quarry-items')) {
    localStorage.setItem('quarry-items', JSON.stringify({ coal: 0 }));
}

function updateCreditsDisplay() {
    const creditCounter = document.getElementById('credit-counter');
    creditCounter.textContent = `Ʉ ${localStorage.getItem('credits') || 0}`;
}

function updateCoalDisplay() {
    let data = JSON.parse(localStorage.getItem('quarry-items'));
    let coalValue = data.coal || 0;
    document.getElementById('coal-value').textContent = coalValue;
}

window.addEventListener('DOMContentLoaded', updateCreditsDisplay);
window.addEventListener('DOMContentLoaded', updateCoalDisplay);

// click rock
const rock = document.getElementById('rock');
const statusText = document.getElementById('status-text');

function clickRock() {
    const rand = Math.random();
    let credits = parseInt(localStorage.getItem('credits')) || 0;
    let data = JSON.parse(localStorage.getItem('quarry-items'));

    if (rand < 0.2) {
        // 20% chance: gain 1 credit
        credits += 1;
        localStorage.setItem('credits', credits);
        updateCreditsDisplay();
        statusText.textContent = 'earned 1 credit'; ///// should really be ${sharpen pick level} pay
    } else if (rand < 0.3) {
        if(data.coal < 998){
            // 10% chance: gain 2–10 coal
            const coalGain = Math.floor(Math.random() * 8) + 2; // 2–10
            data.coal += coalGain;
            if(data.coal > 998){
                data.coal = 999;
            }
            localStorage.setItem('quarry-items', JSON.stringify(data));
            updateCoalDisplay();
            statusText.textContent = `mined ${coalGain} coal`;
        }
        else{
            // data.coal = 999;
            // localStorage.setItem('quarry-items', JSON.stringify(data));
            updateCoalDisplay();
            statusText.textContent = `maxed out on coal`;
        }
    } else {
        // 70% chance: nothing
        statusText.textContent = 'mined a rock';
    }

    localStorage.setItem('quarry-items', JSON.stringify(data));
}

rock.addEventListener('click', () => {
        clickRock();
});