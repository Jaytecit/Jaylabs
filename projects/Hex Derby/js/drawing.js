/* ===== Drawing helpers ===== */
// Motion trails for balls: id -> array of recent positions
let trails = new Map();
function pruneTrails(currentIds){
  for (const id of Array.from(trails.keys())){ if (!currentIds.has(id)) trails.delete(id); }
}
function pushTrailPoint(id, x, y, maxLen){
  let arr = trails.get(id);
  if (!arr) { arr = []; trails.set(id, arr); }
  arr.push({x, y});
  if (arr.length > maxLen) arr.shift();
}

function drawSpace(){
  noStroke(); background(6,8,14);
  for (const s of starfield){
    s.x -= 0.05*s.z; if (s.x<0) s.x += width;
    s.tw += 0.02; const a = 140 + 80*Math.sin(s.tw);
    fill(190,210,255, a*s.z); rect(s.x, s.y, 1+2*s.z, 1+2*s.z);
  }
}
function drawArena(){
  const c=arena.center, R=arena.radius;
  const pts=[]; for (let i=0;i<arena.sides;i++){ const a = arena.rotation + i*(PI/3); pts.push({ x: c.x + Math.cos(a)*R, y: c.y + Math.sin(a)*R }); }
  for (let i=0;i<arena.sides;i++){
    const A=pts[i], B=pts[(i+1)%arena.sides];
    const len=dist(A.x,A.y,B.x,B.y);
    const gap=Math.min(arena.gapWidths[i]||0, len), keep=Math.max(0, len-gap), half=keep/2;
    const mid={x:(A.x+B.x)/2,y:(A.y+B.y)/2};
    const dirx=(B.x-A.x)/len, diry=(B.y-A.y)/len;

    if (half > 1) {
        const p1x = mid.x - dirx * (gap/2 + half);
        const p1y = mid.y - diry * (gap/2 + half);
        const p2x = mid.x - dirx * (gap/2);
        const p2y = mid.y - diry * (gap/2);

        const p3x = mid.x + dirx * (gap/2);
        const p3y = mid.y + diry * (gap/2);
        const p4x = mid.x + dirx * (gap/2 + half);
        const p4y = mid.y + diry * (gap/2 + half);

        strokeWeight(6); stroke(120,175,255,160);
        line(p1x, p1y, p2x, p2y);
        line(p3x, p3y, p4x, p4y);

        strokeWeight(2); stroke(80,140,255,220);
        line(p1x, p1y, p2x, p2y);
        line(p3x, p3y, p4x, p4y);
    }
  }
}

function drawLightning(startPos, angle, length, crackLevel, radius, seed) {
  const minSegmentLength = 5;
  const maxAngleDeviation = 0.5; // radians
  const forkChance = 0.3;

  let currentPos = startPos;
  let remainingLength = length;
  
  beginShape();
  vertex(currentPos.x, currentPos.y);

  while (remainingLength > minSegmentLength) {
    const segmentLength = minSegmentLength + Math.random() * (remainingLength - minSegmentLength) * 0.5;
    
    angle += (Math.random() - 0.5) * maxAngleDeviation;
    
    const nextPos = {
      x: currentPos.x + Math.cos(angle) * segmentLength,
      y: currentPos.y + Math.sin(angle) * segmentLength,
    };

    // Check if the next point is outside the ball's radius
    if (dist(0, 0, nextPos.x, nextPos.y) > radius) {
      break;
    }
    
    vertex(nextPos.x, nextPos.y);

    // Forking logic
    if (Math.random() < forkChance * crackLevel) {
      drawLightning(nextPos, angle + (Math.random() - 0.5) * 1.5, remainingLength * 0.5, crackLevel, radius, seed * Math.random());
    }
    
    currentPos = nextPos;
    remainingLength -= segmentLength;
  }
  
  endShape();
}

function drawBalls(withLabels){
  // Maintain trail entries for current balls
  const idSet = new Set(balls.map(b=>b.id));
  pruneTrails(idSet);

  for (const b of balls){
    const col = color(b.renderColor); const r=b.circleRadius;

    // Push trail point
    pushTrailPoint(b.id, b.position.x, b.position.y, 24);
    const arr = trails.get(b.id) || [];

    // Draw trail (older points are fainter)
    if (arr.length>1){
      noFill();
      for (let i=1;i<arr.length;i++){
        const a = i/(arr.length-1);
        const alpha = 20 + 80*a*a; // ease-in alpha
        stroke(red(col),green(col),blue(col), alpha);
        strokeWeight(2 * a);
        line(arr[i-1].x, arr[i-1].y, arr[i].x, arr[i].y);
      }
    }

    // Low health pulsing glow
    const hp = Math.max(0, Math.min(1, (b.health||0) / (P.ballMaxHealth||100)));
    if (hp < 0.3){
      const t = (millis()%1000)/1000;
      const pul = 0.6 + 0.4*Math.sin(t*TAU);
      noStroke(); fill(255,60,60, 50 + 100*pul);
      ellipse(b.position.x, b.position.y, r*3.0, r*3.0);

      // Add sparking effect for very low health
      if (hp < 0.15 && random() < 0.2) {
        const sparkCount = Math.floor((1 - hp / 0.15) * 3);
        for (let i = 0; i < sparkCount; i++) {
          const angle = random(TAU);
          const sparkRadius = r * 1.1;
          const sx = b.position.x + Math.cos(angle) * sparkRadius;
          const sy = b.position.y + Math.sin(angle) * sparkRadius;
          addBallCollisionSparks(sx, sy, 1);
        }
      }
    }

    // Ball body
    push(); translate(b.position.x,b.position.y); rotate(b.angle||0);
    // Cracking effect based on health
    if (b.health > 0) {
      // Glass layers
      noStroke(); fill(red(col),green(col),blue(col),40); ellipse(0,0,r*2.6,r*2.6);
      stroke(240,250,255,190); strokeWeight(1.2); noFill(); ellipse(0,0,r*2.0,r*2.0);
      noStroke(); fill(255,255,255,150); ellipse(-r*0.4,-r*0.4, r*0.6, r*0.38);
      fill(red(col),green(col),blue(col),85); ellipse(0,0,r*1.7,r*1.7);
      // Cracks as lines
      const crackLevel = 1 - Math.max(0, Math.min(1, (b.health||0) / (P.ballMaxHealth||100)));
      if (crackLevel > 0.1) {
        stroke(220, 220, 255, 180);
        strokeWeight(1.5);
        noFill();

        const numCracks = Math.floor(crackLevel * 4);
        for (let i = 0; i < numCracks; i++) {
          const startAngle = (i * TAU / numCracks) + (b.id * 0.5) + (crackLevel * millis() / 1000);
          const startRadius = r * 0.1;
          const startPoint = {
            x: Math.cos(startAngle) * startRadius,
            y: Math.sin(startAngle) * startRadius
          };
          drawLightning(startPoint, startAngle, r * 1.2 * crackLevel, crackLevel, r, b.id + i);
        }
      }
    } else {
      // Ball is broken: draw shards and let person drift
      for (let i=0;i<7;i++) {
        const ang = i*PI/3 + millis()/500 + b.id;
        fill(220,220,255,60); noStroke();
        beginShape();
        for (let j=0;j<4;j++) {
          const a = ang + j*PI/8 + random(-0.1,0.1);
          const rad = r*1.7 * (0.7 + 0.3*j/3);
          vertex(Math.cos(a)*rad, Math.sin(a)*rad);
        }
        endShape(CLOSE);
      }
    }

    // Draw little person inside the ball (drifting if broken)
    push();
    let px = 0, py = 0;
    if (b.person) {
      px = b.person.position.x;
      py = b.person.position.y;
    }

    if (b.health <= 0) {
      const drift = millis() / 400 + b.id;
      px += Math.cos(drift) * r * 0.7;
      py += Math.sin(drift) * r * 0.7;
    } else {
      // when alive, the base position is already set from b.person.position
    }
    
    // Unique color for each character
    const personCol = color(180 + (b.id*37)%60, 120 + (b.id*53)%80, 60 + (b.id*91)%100);
    // Body
    fill(personCol); noStroke(); ellipse(px, py, r*0.7, r*0.9);
    // Head
    fill(255, 220, 180); ellipse(px, py-r*0.4, r*0.45, r*0.45);
    // Eyes
    fill(40); ellipse(px-r*0.09, py-r*0.43, r*0.08, r*0.08); ellipse(px+r*0.09, py-r*0.43, r*0.08, r*0.08);
    // Smile
    stroke(80); strokeWeight(1.2); noFill(); arc(px, py-r*0.35, r*0.22, r*0.18, 0, PI);
    pop();

    pop();

    // Selection halo
    if (typeof selectedBallId !== 'undefined'){
      const isSel = (b.id===selectedBallId) || (typeof selectedBallId2!=='undefined' && b.id===selectedBallId2);
      if (isSel){
        const t = (millis()%1000)/1000;
        const pul = 0.6 + 0.4*Math.sin(t*TAU);
        noFill(); stroke(255,255,255, 180);
        strokeWeight(2 + 2*pul);
        ellipse(b.position.x, b.position.y, (r*2.6) + 6*pul, (r*2.6) + 6*pul);
      }
    }

    if (withLabels){
      const tag=`#${b.id+1}`;
      push();
      textAlign(CENTER,BOTTOM);
      textSize(12);
      fill(230,240,255,160);
      noStroke();
      text(tag, b.position.x, b.position.y - b.circleRadius - 10);
      pop();
    }
  }
}

function drawFreePeople() {
  for (const p of freePeople) {
    const r = p.circleRadius;
    const px = p.position.x;
    const py = p.position.y;

    push();
    translate(px, py);
    
    // Unique color for each character
    const personCol = color(180 + (p.id*37)%60, 120 + (p.id*53)%80, 60 + (p.id*91)%100);
    
    // Fade out
    const alpha = 255 * p.life;
    personCol.setAlpha(alpha);

    // Body
    fill(personCol);
    noStroke();
    ellipse(0, 0, r*0.7, r*0.9);
    
    // Head
    const headCol = color(255, 220, 180);
    headCol.setAlpha(alpha);
    fill(headCol);
    ellipse(0, -r*0.4, r*0.45, r*0.45);
    
    // Eyes
    const eyeCol = color(40);
    eyeCol.setAlpha(alpha);
    fill(eyeCol);
    ellipse(-r*0.09, -r*0.43, r*0.08, r*0.08);
    ellipse(r*0.09, -r*0.43, r*0.08, r*0.08);
    
    // Smile
    const smileCol = color(80);
    smileCol.setAlpha(alpha);
    stroke(smileCol);
    strokeWeight(1.2);
    noFill();
    arc(0, -r*0.35, r*0.22, r*0.18, 0, PI);
    
    pop();
  }
}

/* ===== FX ===== */
function addImpact(x,y,intensity=3){ impacts.push({x,y,life:1,power:Math.min(intensity * P.impactPowerMultiplier,1)}); }
function addExplosion(x,y){
  for (let i=0;i<40;i++){
    const a=random(TWO_PI), sp=random(1,5);
    sparks.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:1});
  }
}
function addBallCollisionSparks(x, y, count) {
  for (let i = 0; i < count; i++) {
    const a = random(TWO_PI), sp = random(P.sparkMinSpeed, P.sparkMaxSpeed); // Smaller speed for sparks
    sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: P.sparkLife });
  }
}
function drawFX(){
  drawingContext.globalCompositeOperation='lighter';
  for (let i=impacts.length-1;i>=0;i--){
    const it=impacts[i], a=120*it.life*it.power;
    noStroke(); fill(255,230,200,a*0.6); ellipse(it.x,it.y,60*it.power,60*it.power);
    fill(120,180,255,a*0.5); ellipse(it.x,it.y,100*it.power,100*it.power);
    it.life-=P.impactLifeDecay; if(it.life<=0) impacts.splice(i,1);
  }
  for (let i=sparks.length-1;i>=0;i--){
    const s=sparks[i]; s.x+=s.vx; s.y+=s.vy; s.vx*=0.98; s.vy*=0.98; s.life-=0.03;
    strokeWeight(2); stroke(255,255,255,220*s.life); point(s.x,s.y);
    if (s.life<=0) sparks.splice(i,1);
  }
  drawingContext.globalCompositeOperation='source-over';
}
