import React, { useMemo, useRef, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Waves, Zap, Settings } from "lucide-react";

export default function PositionalEncodingVisualizer() {
  const [seqLen, setSeqLen] = useState(150);
  const [dModel, setDModel] = useState(64);
  const [base, setBase] = useState(10000);
  const [highlightPos, setHighlightPos] = useState(149);
  const darkMode = true;
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(0.02);
  const animationRef = useRef(null);
  const timeRef = useRef(0);

  // Propagate dark theme to document
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("dark");
  }, []);

  // Animation loop
  useEffect(() => {
    if (isAnimating) {
      const animate = () => {
        timeRef.current += animationSpeed;
        setHighlightPos(() => {
          const newPos = Math.floor((Math.sin(timeRef.current) * 0.5 + 0.5) * (seqLen - 1));
          return Math.max(0, Math.min(seqLen - 1, newPos));
        });
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isAnimating, animationSpeed, seqLen]);

  const LINE_WIDTH = 2.5;
  const SAMPLES_PER_TOKEN = 10;
  const iMax = Math.max(0, Math.floor(dModel / 2) - 1);
  // Changed to 4 pairs
  const FRACTIONS = [0.0, 0.3, 0.6, 0.9];
  const selectedPairs = Array.from(
    new Set(FRACTIONS.map((f) => Math.min(iMax, Math.max(0, Math.round(f * iMax)))))
  ).sort((a, b) => a - b);
  const pairsToDraw = selectedPairs.length;

  const clampedHighlight = Math.max(0, Math.min(seqLen - 1, highlightPos));

  // Reduced dimensions
  const rowHeight = 60;
  const rowGap = 16;
  const padLeft = 80;
  const padRight = useMemo(() => {
    const labelLen = (pair, kind) =>
      (kind === "sin"
        ? `PE(pos, ${2 * pair}) = sin(pos / ${base}^{${(2 * pair)}/${dModel}})`
        : `PE(pos, ${2 * pair + 1}) = cos(pos / ${base}^{${(2 * pair)}/${dModel}})`).length;
    let longest = 0;
    for (const p of selectedPairs) {
      longest = Math.max(longest, labelLen(p, "sin"), labelLen(p, "cos"));
    }
    const approxCharWidth = 6.5;
    return Math.max(220, Math.ceil(longest * approxCharWidth + 30));
  }, [selectedPairs, base, dModel]);

  const padTop = 30;
  const padBottom = 40;
  const chartWidth = 800; // Reduced from 1200
  const rowsCount = pairsToDraw * 2;
  const chartHeight = rowsCount * (rowHeight + rowGap) - rowGap;
  const svgWidth = padLeft + chartWidth + padRight;
  const svgHeight = padTop + chartHeight + padBottom;

  const tokenStep = chartWidth / Math.max(1, seqLen - 1);
  const sampleCount = Math.max(2, (seqLen - 1) * SAMPLES_PER_TOKEN + 1);
  const sampleStep = chartWidth / (sampleCount - 1);
  const xForToken = (p) => padLeft + p * tokenStep;

  function pathFromYs(ys) {
    if (!ys.length) return "";
    let d = `M ${padLeft} ${ys[0]}`;
    for (let i = 1; i < ys.length; i++) d += ` L ${padLeft + i * sampleStep} ${ys[i]}`;
    return d;
  }

  const rows = useMemo(() => {
    const rowsOut = [];
    const xs = Array.from({ length: sampleCount }, (_, i) => i / SAMPLES_PER_TOKEN);

    for (const pair of selectedPairs) {
      const exponent = (2 * pair) / dModel;
      const denom = Math.pow(base, exponent);
      const amp = (rowHeight / 2) * 0.85;

      const sinIndex = rowsOut.length;
      const sinCenter = padTop + sinIndex * (rowHeight + rowGap) + rowHeight / 2;
      const sinYs = xs.map((pos) => sinCenter - Math.sin(pos / denom) * amp);
      const sinVal = Math.sin(clampedHighlight / denom);
      rowsOut.push({
        kind: "sin",
        pair,
        path: pathFromYs(sinYs),
        yAtHighlight: sinCenter - sinVal * amp,
        valAtHighlight: sinVal,
        centerY: sinCenter,
        label: `PE(pos, ${2 * pair}) = sin(pos / ${base}^{${(2 * pair)}/${dModel}})`,
        frequency: 1 / denom,
      });

      const cosIndex = rowsOut.length;
      const cosCenter = padTop + cosIndex * (rowHeight + rowGap) + rowHeight / 2;
      const cosYs = xs.map((pos) => cosCenter - Math.cos(pos / denom) * amp);
      const cosVal = Math.cos(clampedHighlight / denom);
      rowsOut.push({
        kind: "cos",
        pair,
        path: pathFromYs(cosYs),
        yAtHighlight: cosCenter - cosVal * amp,
        valAtHighlight: cosVal,
        centerY: cosCenter,
        label: `PE(pos, ${2 * pair + 1}) = cos(pos / ${base}^{${(2 * pair)}/${dModel}})`,
        frequency: 1 / denom,
      });
    }
    return rowsOut;
  }, [selectedPairs, dModel, base, clampedHighlight, sampleCount]);

  const svgRef = useRef(null);
  function handleMouseMove(e) {
    if (isAnimating) return;
    const svg = svgRef.current; if (!svg) return;
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svg.getScreenCTM(); if (!ctm) return;
    const local = pt.matrixTransform(ctm.inverse());
    const x = local.x - padLeft; const p = Math.round(x / tokenStep);
    if (p >= 0 && p < seqLen) setHighlightPos(p);
  }
  const highlightX = xForToken(clampedHighlight);

  // Enhanced color palette - dark theme only
  const bgGradient = "bg-gradient-to-br from-slate-950 via-purple-950/30 to-pink-950/20";
  const cardBg = "bg-slate-900/70 backdrop-blur-xl border-purple-800/30";
  const headerBg = "bg-slate-900/90 backdrop-blur-xl border-purple-800/30";
  const axisColor = "#4c1d95";
  const gridColor = "#2d1b69";
  
  // Neon wave colors
  const waveSinStart = "#00bfff";
  const waveSinEnd = "#00ffff";
  const waveCosStart = "#ff1493";
  const waveCosEnd = "#ff69b4";
  
  const canvasBg = "#1a1a2e";
  const textColor = "#f1f5f9";
  const highlightLine = "#a855f7";

  return (
    <div className={`min-h-screen w-full transition-all duration-700 ${bgGradient}`}>
      <div className="mx-auto w-full max-w-screen-xl px-4">

        <header className={`${headerBg} shadow-lg`}>
          <div className="max-w-7xl mx-auto flex justify-between items-center p-4">
            <div className="flex gap-3 items-center">
              <div className="p-2 rounded-full bg-purple-500/20 backdrop-blur-sm">
                <Waves className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Sinusoidal Positional Encoding
                </h1>
                <p className="text-xs text-purple-300">
                  Interactive visualization of transformer position embeddings
                </p>
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAnimating(!isAnimating)}
              className={`hover:bg-slate-800 transition-colors ${isAnimating ? 'text-purple-400' : ''}`}
            >
              <Zap className={`w-4 h-4 ${isAnimating ? 'animate-pulse' : ''}`} />
              {isAnimating ? 'Stop' : 'Animate'}
            </Button>
          </div>
        </header>

        <main className="p-4 flex justify-center">
          <div className="w-full max-w-6xl">
            <Card className={`${cardBg} rounded-2xl shadow-2xl border h-fit mb-4`}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg justify-center">
                <Settings className="w-4 h-4 text-purple-400" />
                Controls
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-medium flex justify-between">
                    <span>Sequence Length</span>
                    <span className="px-2 py-1 rounded text-xs bg-slate-800 text-purple-400 font-mono">
                      {seqLen}
                    </span>
                  </Label>
                  <Slider 
                    value={[seqLen]} 
                    min={8} 
                    max={4096} 
                    step={1} 
                    onValueChange={(v) => setSeqLen(v[0])}
                    className="py-1"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs font-medium flex justify-between">
                    <span>Model Dimension (d)</span>
                    <span className="px-2 py-1 rounded text-xs bg-slate-800 text-pink-400 font-mono">
                      {dModel}
                    </span>
                  </Label>
                  <Slider 
                    value={[dModel]} 
                    min={10} 
                    max={1024} 
                    step={2} 
                    onValueChange={(v) => setDModel(v[0])}
                    className="py-1"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs font-medium flex justify-between">
                    <span>Base Constant</span>
                    <span className="px-2 py-1 rounded text-xs bg-slate-800 text-orange-400 font-mono">
                      {base.toLocaleString()}
                    </span>
                  </Label>
                  <Slider 
                    value={[base]} 
                    min={10} 
                    max={100000} 
                    step={10} 
                    onValueChange={(v) => setBase(v[0])}
                    className="py-1"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs font-medium flex justify-between">
                    <span>Highlight Position</span>
                    <span className="px-2 py-1 rounded text-xs bg-slate-800 text-purple-400 font-mono">
                      {clampedHighlight}
                    </span>
                  </Label>
                  <Slider 
                    value={[clampedHighlight]} 
                    min={0} 
                    max={seqLen - 1} 
                    step={1} 
                    onValueChange={(v) => !isAnimating && setHighlightPos(v[0])}
                    disabled={isAnimating}
                    className="py-1"
                  />
                </div>
              </div>

              {isAnimating && (
                <div className="mt-4 space-y-2 max-w-md mx-auto">
                  <Label className="text-xs font-medium flex justify-between">
                    <span>Animation Speed</span>
                    <span className="px-2 py-1 rounded text-xs bg-slate-800 text-pink-400 font-mono">
                      {animationSpeed.toFixed(3)}
                    </span>
                  </Label>
                  <Slider 
                    value={[animationSpeed]} 
                    min={0.005} 
                    max={0.1} 
                    step={0.005} 
                    onValueChange={(v) => setAnimationSpeed(v[0])}
                    className="py-1"
                  />
                </div>
              )}
              
              <div className="mt-4 p-3 rounded-lg bg-slate-800/50 border-l-3 border-l-purple-500 max-w-md mx-auto">
                <p className="text-xs text-slate-300 leading-relaxed text-center">
                  <span className="font-semibold">Showing 4 frequency pairs</span>.
                  <span className="font-semibold"> Indices:</span> {selectedPairs.join(", ")}
                  <span className="font-semibold"> Position:</span> {clampedHighlight}
                </p>
              </div>
            </CardContent>
          </Card>

            <Card className={`${cardBg} rounded-2xl shadow-2xl border overflow-hidden`}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg justify-center">
                  <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                  Encoding Waves
                  <div className="ml-auto text-sm font-normal text-purple-300">
                    Pos {clampedHighlight}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex justify-center">
                <div className="overflow-x-auto">
                <svg 
                  ref={svgRef} 
                  width={svgWidth} 
                  height={svgHeight} 
                  onMouseMove={handleMouseMove}
                  className="cursor-crosshair transition-all duration-200 hover:drop-shadow-lg"
                >
                  <defs>
                    {/* Wave gradients */}
                    <linearGradient id="sin-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor={waveSinStart} />
                      <stop offset="100%" stopColor={waveSinEnd} />
                    </linearGradient>
                    
                    <linearGradient id="cos-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor={waveCosStart} />
                      <stop offset="100%" stopColor={waveCosEnd} />
                    </linearGradient>
                  </defs>

                  <rect width={svgWidth} height={svgHeight} fill={canvasBg} />

                  {/* Enhanced grid */}
                  <g opacity="0.6">
                    {Array.from({ length: rowsCount + 1 }, (_, i) => {
                      const y = padTop + (i * chartHeight) / rowsCount;
                      return (
                        <g key={`h-${i}`}>
                          <line 
                            x1={padLeft} 
                            x2={padLeft + chartWidth} 
                            y1={y} 
                            y2={y} 
                            stroke={i % 2 === 0 ? axisColor : gridColor} 
                            strokeWidth={i % 2 === 0 ? 1.5 : 1}
                            opacity={i % 2 === 0 ? 1 : 0.5}
                          />
                          {i < rows.length && (
                            <text 
                              x={padLeft - 10} 
                              y={rows[i]?.centerY + 4 || y} 
                              textAnchor="end" 
                              fill={textColor} 
                              fontSize="12"
                              fontWeight="600"
                              fontFamily="monospace"
                            >
                              {rows[i] ? `${rows[i].valAtHighlight >= 0 ? "+" : ""}${rows[i].valAtHighlight.toFixed(2)}` : ""}
                            </text>
                          )}
                        </g>
                      );
                    })}
                    {Array.from({ length: 9 }, (_, i) => {
                      const x = padLeft + (i * chartWidth) / 8;
                      return (
                        <line 
                          key={`v-${i}`} 
                          x1={x} 
                          x2={x} 
                          y1={padTop} 
                          y2={padTop + chartHeight} 
                          stroke={gridColor} 
                          strokeWidth={1}
                          opacity={0.3}
                        />
                      );
                    })}
                  </g>

                  {/* Highlight line */}
                  <line
                    x1={highlightX}
                    x2={highlightX}
                    y1={padTop}
                    y2={padTop + chartHeight}
                    stroke={highlightLine}
                    strokeWidth={2.5}
                    strokeDasharray="6 8"
                    opacity={0.8}
                  />

                  {/* Wave paths with gradients */}
                  {rows.map((row, idx) => (
                    <g key={idx}>
                      <path
                        d={row.path}
                        fill="none"
                        stroke={row.kind === "sin" ? "url(#sin-gradient)" : "url(#cos-gradient)"}
                        strokeWidth={LINE_WIDTH}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        opacity={0.9}
                      />
                      
                      {/* Static highlight point */}
                      <circle
                        cx={highlightX}
                        cy={row.yAtHighlight}
                        r={4}
                        fill={row.kind === "sin" ? waveSinEnd : waveCosEnd}
                      />
                      
                      {/* Enhanced labels */}
                      <text 
                        x={padLeft + chartWidth + 15} 
                        y={row.centerY + 4} 
                        className="text-xs font-medium"
                        fill={textColor}
                        style={{ fontFamily: 'ui-monospace, monospace' }}
                      >
                        {row.label}
                      </text>
                      
                      {/* Frequency indicator */}
                      <text 
                        x={padLeft + chartWidth + 15} 
                        y={row.centerY + 18} 
                        className="text-xs"
                        fill="#64748b"
                        style={{ fontFamily: 'ui-monospace, monospace' }}
                      >
                        f ≈ {row.frequency.toExponential(1)}
                      </text>
                    </g>
                  ))}
                </svg>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
       </div> 
    </div>
  );
}