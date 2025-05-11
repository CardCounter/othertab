// text
const avgRaw = localStorage.getItem("TYPING-avg");
let avgWPM = "NA";
let avgACC = "NA";

if (avgRaw) {
    try {
        const avg = JSON.parse(avgRaw);
        avgWPM = avg.wpm ?? "NA";
        avgACC = avg.acc ?? "NA";
    } catch (e) {}
}

document.getElementById("avgStats").textContent = `avg wpm ${avgWPM} avg acc ${avgACC}%`;

// table
[10, 25, 50, 100].forEach(num => {
    const key = `TYPING-best-mode-${num}`;
    const raw = localStorage.getItem(key);
    let wpm = "NA", acc = "NA";
    if (raw) {
        try {
            const data = JSON.parse(raw);
            wpm = data.wpm ?? "NA";
            acc = data.acc ?? "NA";
        } catch (e) {}
    }
    document.getElementById(`wpm-${num}`).textContent = wpm;
    document.getElementById(`acc-${num}`).textContent = `${acc}%`;
});