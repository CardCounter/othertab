const minesOverlay  = document.getElementById('mines');
const openMinesBtn  = document.getElementById('open-mines');
const closeMinesBtn = document.getElementById('close-mines');

let minesGame = null;
openMinesBtn.addEventListener('click', e => {
    e.preventDefault();
    minesOverlay.classList.add('active');
    if (!minesGame) minesGame = new GemMine();
});
closeMinesBtn.addEventListener('click', () => {
    minesOverlay.classList.remove('active');
});

let data = JSON.parse(localStorage.getItem('quarry-items'));
function getCoal()  { return data.coal || 0; }
function setCoal(n) { localStorage.setItem('coal', n); }


const gemShapes = {
    greenCross: [[0,0],[-1,0],[1,0],[0,-1],[0,1]],
    pinkPlus:   [[0,0],[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]],
    goldSquare: [[0,0],[1,0],[0,1],[1,1]]
};

class GemMine {
    constructor(rows=16, cols=16, clickCost=1) {
        this.rows = rows; this.cols = cols; this.clickCost = clickCost;

        this.gridEl   = document.getElementById('grid');
        this.coalEl   = document.getElementById('coal-counter');
        this.gemEl    = document.getElementById('gem-counter');
        this.gemTotEl = document.getElementById('gem-total');
        this.clickEl  = document.getElementById('click-counter');
        this.statusEl = document.getElementById('status-text');
        this.newBtn   = document.getElementById('new-game');
        this.homeBtn  = document.getElementById('return-home');

        this.newBtn.onclick = () => this.resetBoard();

        this.resetAll();
    }

    resetAll() {
        this.grid=[]; 
        this.placedGems=[]; 
        this.revealedGemCells=new Set();
        this.clicks=0; 
        this.finished=false; 
        this.totalGemCells=0;

        this.buildEmptyGrid();
        this.placeGems();
        this.computeHints();
        this.renderGrid();
        this.updatePanels();
        this.homeBtn.hidden=true;
    }

    buildEmptyGrid() {
        this.grid = Array.from({length:this.rows},()=>Array.from({length:this.cols},()=>({
        type:'hint',    // hint | gem | coal
        gemId:null,
        value:0,
        revealed:false
        })));
    }

    placeGems() {
        const shapesToPlace = ['greenCross','greenCross','pinkPlus','goldSquare','goldSquare','goldSquare']; // get more gems, cut off list depending on board size
        let uid=1;

        shapesToPlace.forEach(shapeName=>{
            const shape=gemShapes[shapeName];
            let placed=false, tries=0;
            while(!placed && tries<200){
                tries++;
                const ox=Math.floor(Math.random()*this.cols);
                const oy=Math.floor(Math.random()*this.rows);
                if(shape.every(([dx,dy])=>{
                    const x=ox+dx, y=oy+dy;
                    return x>=0&&x<this.cols&&y>=0&&y<this.rows && this.grid[y][x].type!=='gem';
                })){
                const id='g'+uid++;
                const cells=shape.map(([dx,dy])=>[ox+dx,oy+dy]);
                cells.forEach(([x,y])=>{
                    this.grid[y][x].type='gem';
                    this.grid[y][x].gemId=id;
                });
                this.placedGems.push({id,type:shapeName,cells,found:false});
                this.totalGemCells+=cells.length;
                placed=true;
                }
            }
        });
        this.gemTotEl.textContent=this.placedGems.length;
    }

    computeHints() {
        const nearest = (x,y)=>{
        let best=Infinity;
        for(const g of this.placedGems)
            for(const [gx,gy] of g.cells)
            best=Math.min(best,Math.abs(gx-x)+Math.abs(gy-y));
        return best;
        };

        for(let y=0;y<this.rows;y++)
        for(let x=0;x<this.cols;x++){
            const c=this.grid[y][x];
            if(c.type==='gem') continue;
            if(Math.random()<0.05){ c.type='coal'; }
            else { const d=nearest(x,y); c.value=d>9?'>':d; }
        }
    }

    renderGrid() {
        this.gridEl.innerHTML='';
        this.gridEl.style.gridTemplateColumns=`repeat(${this.cols},30px)`;
        this.gridEl.style.gridTemplateRows  =`repeat(${this.rows},30px)`;

        for(let y=0;y<this.rows;y++)
        for(let x=0;x<this.cols;x++){
            const div=document.createElement('div');
            div.className='cell';
            div.dataset.x=x; div.dataset.y=y;
            div.onclick = () => this.reveal(x,y,div);
            this.gridEl.appendChild(div);
        }
    }

    reveal(x,y,div){
        if(this.finished) return;
        if(this.grid[y][x].revealed) return;

        let coal=getCoal();
        if(coal<this.clickCost){ this.outOfCoal(); return; }
        coal-=this.clickCost; setCoal(coal);

        const cell=this.grid[y][x];
        cell.revealed=true; this.clicks++;

        if(cell.type==='gem'){
        div.textContent='◆'; div.classList.add('gem');
        this.revealedGemCells.add(`${x},${y}`);
        this.checkGem(cell.gemId);
        }else if(cell.type==='coal'){
        div.textContent='C'; div.classList.add('coal-cell');
        setCoal(getCoal()+5);
        }else{
        div.textContent=cell.value===0?'':cell.value;
        if(cell.value!=='>'&&cell.value!=='')
            div.classList.add(`color-${cell.value}`);
        }
        div.classList.add('revealed');

        this.updatePanels();
        this.checkEnd();
    }

    checkGem(id){
        const g=this.placedGems.find(g=>g.id===id);
        if(g.found) return;
        if(g.cells.every(([x,y])=>this.grid[y][x].revealed)){
        g.found=true;
        const earn=g.cells.length*2;
        const credits=Number(localStorage.getItem('credits')||0)+earn;
        localStorage.setItem('credits',credits);
        this.statusEl.textContent=`found gem (+${earn}Ʉ)`;
        }
    }

    /* -------- panels & end‑states ------------------------------------ */
    updatePanels(){
        this.coalEl.textContent=getCoal();
        this.gemEl.textContent=this.placedGems.filter(g=>g.found).length;
        this.clickEl.textContent=this.clicks;
    }
    outOfCoal(){
        this.statusEl.textContent='out of coal — go home';
        this.gameOver();
    }
    checkEnd(){
        const allFound=this.placedGems.every(g=>g.found);
        if(allFound){ this.statusEl.textContent='all gems found!'; this.gameOver(true); }
    }
    gameOver(won=false){
        this.finished=true;
        this.gridEl.style.pointerEvents='none';
        if(won && getCoal()>0){
        this.newBtn.hidden=false;
        }else{
        this.homeBtn.hidden=false;
        }
    }

    /* -------- reset button ------------------------------------------- */
    resetBoard(){          // only allowed if player still has coal
        if(getCoal()<this.clickCost) return;
        this.newBtn.hidden=true;
        this.gridEl.style.pointerEvents='';
        this.statusEl.textContent='';
        this.resetAll();
    }
}