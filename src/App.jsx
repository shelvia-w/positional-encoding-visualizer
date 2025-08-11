import React, { useMemo, useRef, useState, useEffect, useLayoutEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Waves, Settings } from "lucide-react";

export default function PositionalEncodingVisualizer() {
  const [seqLen, setSeqLen] = useState(150);
  const [dModel, setDModel] = useState(64);
  const [base, setBase] = useState(10000);
  const [highlightPos, setHighlightPos] = useState(149);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const LINE_WIDTH = 2.5;
  const SAMPLES_PER_TOKEN = 10;
  const iMax = Math.max(0, Math.floor(dModel / 2) - 1);
  const FRACTIONS = [0.0, 0.2, 0.4, 0.7];

  const selectedPairs = useMemo(
    () =>
      Array.from(
        new Set(FRACTIONS.map((f) => Math.min(iMax, Math.max(0, Math.round(f * iMax)))))
      ).sort((a, b) => a - b),
    [FRACTIONS, iMax]
  );

  const pairsToDraw = selectedPairs.length;
  const clampedHighlight = Math.max(0, Math.min(seqLen - 1, highlightPos));

  const chartContainerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(1200);

  useLayoutEffect(() => {
    if (!chartContainerRef.current) return;
    const el = chartContainerRef.current;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(Math.max(320, entry.contentRect.width));
      }
    });
    ro.observe(el);
    setContainerWidth(Math.max(320, el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);

  const { padLeft, padRight } = useMemo(() => {
    const leftPad = Math.max(60, containerWidth * 0.1);
    const approxCharWidth = 7.5;
    const maxLabelLen = Math.max(
      ...selectedPairs.map(
        (p) => `PE(pos, ${2 * p}) = sin(pos / ${base}^{${(2 * p)}/${dModel}})`.length
      )
    );
    const labelSpace = maxLabelLen * approxCharWidth + 20;
    return { padLeft: leftPad, padRight: leftPad + labelSpace };
  }, [containerWidth, selectedPairs, base, dModel]);

  const padTop = 40;
  const padBottom = 90;
  const rowHeight = 30;
  const rowGap = 32;

  const rowsCount = pairsToDraw * 2;
  const availableWidth = containerWidth - padLeft - padRight;
  const chartWidth = Math.max(200, availableWidth * 0.95);
  const chartHeight = rowsCount * (rowHeight + rowGap) - 32;
  const svgWidth = containerWidth;
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
      const amp = (rowHeight / 2) * 0.75;
      const offset = 10;

      const sinIndex = rowsOut.length;
      const sinCenter = padTop + sinIndex * (rowHeight + rowGap) + rowHeight / 2 + offset;
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
      const cosCenter = padTop + cosIndex * (rowHeight + rowGap) + rowHeight / 2 + offset;
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
  }, [selectedPairs, dModel, base, clampedHighlight, sampleCount, padTop, sampleStep, padLeft]);

  const svgRef = useRef(null);
  function handleMouseMove(e) {
    const svg = svgRef.current;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const local = pt.matrixTransform(ctm.inverse());
    const p = Math.round((local.x - padLeft) / tokenStep);
    if (p >= 0 && p < seqLen) setHighlightPos(p);
  }
  const highlightX = xForToken(clampedHighlight);

  const bgGradient = "bg-gradient-to-br from-slate-950 via-purple-950/30 to-pink-950/20";
  const cardBg = "bg-slate-900/70 backdrop-blur-xl border-purple-800/30";
  const headerBg = "bg-slate-900/90 backdrop-blur-xl border-purple-800/30";
  const axisColor = "#4c1d95";
  const gridColor = "#2d1b69";
  const waveSinStart = "#00bfff";
  const waveSinEnd = "#00ffff";
  const waveCosStart = "#ff1493";
  const waveCosEnd = "#ff69b4";
  const canvasBg = "#1a1a2e";
  const textColor = "#f1f5f9";
  const highlightLine = "#a855f7";

  const fontSize = containerWidth >= 1200 ? "14" : containerWidth >= 768 ? "12" : "10";
  const labelFontSize = containerWidth >= 1200 ? "16" : containerWidth >= 768 ? "14" : "10";

  return (
    <div className={`min-h-screen w-screen transition-all duration-700 ${bgGradient}`}>
      <header className={`${headerBg} shadow-lg h-20`}>
        <div className="h-full container mx-auto max-w-none flex justify-between items-center px-8">
          <div className="flex gap-5   items-center">
            <div className="p-3 rounded-full bg-purple-500/20 backdrop-blur-sm">
              <Waves className="w-6 h-6 text-purple-400" />
            </div>
            <div className="space-y-1 flex-1">
              <h1
                className="font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent leading-tight"
                style={{ fontSize: "24px", lineHeight: "1.4" }}
              >
                Sinusoidal Positional Encoding
              </h1>
              <p className="text-purple-300 leading-relaxed" style={{ fontSize: "14px", lineHeight: "1.3" }}>
                Interactive visualization of transformer position embeddings
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full flex flex-col gap-4 p-4">
        <Card className={`${cardBg} rounded-xl shadow-xl border h-fit`}>
          <CardHeader className="pb-1 py-0">
            <CardTitle className="flex items-center gap-3 text-xl justify-center">
              <Settings className="w-5 h-5 text-purple-400" />
              <span>Controls</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 pb-1">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-1">
                <Label className="text-base font-medium flex justify-between items-center font-mono">
                  <span>Sequence Length (L)</span>
                  <span className="px-3 py-1.5 rounded-md text-sm bg-slate-800 text-purple-400 font-mono min-w-[3rem] text-center">
                    {seqLen}
                  </span>
                </Label>
                <Slider value={[seqLen]} min={8} max={4096} step={1} onValueChange={(v) => setSeqLen(v[0])} className="py-1" />
              </div>

              <div className="space-y-2">
                <Label className="text-base font-medium flex justify-between items-center font-mono">
                  <span>Model Dimension (d)</span>
                  <span className="px-3 py-1.5 rounded-md text-sm bg-slate-800 text-pink-400 font-mono min-w-[3rem] text-center">
                    {dModel}
                  </span>
                </Label>
                <Slider value={[dModel]} min={10} max={1024} step={2} onValueChange={(v) => setDModel(v[0])} className="py-1" />
              </div>

              <div className="space-y-2">
                <Label className="text-base font-medium flex justify-between items-center font-mono">
                  <span>Base Constant (C)</span>
                  <span className="px-3 py-1.5 rounded-md text-sm bg-slate-800 text-orange-400 font-mono min-w-[4rem] text-center">
                    {base.toLocaleString()}
                  </span>
                </Label>
                <Slider value={[base]} min={10} max={100000} step={10} onValueChange={(v) => setBase(v[0])} className="py-1" />
              </div>

              <div className="space-y-2">
                <Label className="text-base font-medium flex justify-between items-center font-mono">
                  <span>Token Position (pos)</span>
                  <span className="px-3 py-1.5 rounded-md text-sm bg-slate-800 text-purple-400 font-mono min-w-[3rem] text-center">
                    {clampedHighlight}
                  </span>
                </Label>
                <Slider value={[clampedHighlight]} min={0} max={seqLen - 1} step={1} onValueChange={(v) => setHighlightPos(v[0])} className="py-1" />
              </div>
            </div>

            {/* <div className="mt-6 p-3 rounded-lg bg-slate-800/50 border-l-4 border-l-purple-500 max-w-lg mx-auto">
              <p className="text-lg text-slate-300 leading-relaxed text-center">
                  <span className="font-semibold text-purple-300 text-base">(Showing 4 frequency pairs only)   </span>
                  <span className="ml-8 font-semibold text-white text-sm font-mono">Indices (i) : {selectedPairs.join(", ")} </span>
              </p>
            </div> */}
          </CardContent>
        </Card>

        <Card className={`${cardBg} rounded-2xl shadow-2xl border flex-1 flex flex-col overflow-hidden min-h-0`}>
          <CardHeader className="pb-1 py-1">
            <CardTitle className="flex items-center gap-3 text-xl px-2 w-full">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-purple-400 animate-pulse" />
                <span>Encoding Waves</span>
              </div>
              <div className="flex-1 flex justify-center">
                <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-2" style={{ fontSize: "clamp(10px, 1.4vw, 14px)" }}>
                  <div className="flex items-center gap-2 text-sm font-mono">
                    <span className="text-slate-400">PE(pos, 2i) =</span>
                    <span style={{ color: waveSinEnd }}>sin(pos / C^(2i/d))</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-mono">
                    <span className="text-slate-400">PE(pos, 2i+1) =</span>
                    <span style={{ color: waveCosEnd }}>cos(pos / C^(2i/d))</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-mono">
                    <span className="text-slate-400">Indices (i):</span>
                    <span className="text-purple-300">{selectedPairs.join(", ")}</span>
                    <span className="text-slate-400">(showing 4 frequencies only)</span>
                  </div>
                </div>
              </div>
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0 flex-1 flex min-h-0">
            <div ref={chartContainerRef} className="flex-1 overflow-x-auto overflow-y-auto min-h-0 w-full">
              <svg
                ref={svgRef}
                width="100%"
                height={svgHeight}
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                onMouseMove={handleMouseMove}
                className="cursor-crosshair transition-all duration-200 hover:drop-shadow-lg"
              >
                <defs>
                  <linearGradient id="sin-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={waveSinStart} />
                    <stop offset="100%" stopColor={waveSinEnd} />
                  </linearGradient>
                  <linearGradient id="cos-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={waveCosStart} />
                    <stop offset="100%" stopColor={waveCosEnd} />
                  </linearGradient>
                </defs>

                <rect width={svgWidth} height={svgHeight} fill={canvasBg} rx="12" />

                {/* Grid + row value labels */}
                <g opacity="1">
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
                            x={padLeft - 20}
                            y={rows[i]?.centerY + 5 || y}
                            textAnchor="end"
                            fill={rows[i]?.kind === "sin" ? waveSinEnd : waveCosEnd}
                            fontSize={fontSize}
                            fontWeight="600"
                            fontFamily="ui-monospace, monospace"
                          >
                            {rows[i] ? `${rows[i].valAtHighlight >= 0 ? "+" : ""}${rows[i].valAtHighlight.toFixed(2)}` : ""}
                          </text>
                        )}
                      </g>
                    );
                  })}
                  {Array.from({ length: 9 }, (_, i) => {
                    const x = padLeft + (i * chartWidth) / 8;
                    return <line key={`v-${i}`} x1={x} x2={x} y1={padTop} y2={padTop + chartHeight} stroke={gridColor} strokeWidth={1} opacity={0.3} />;
                  })}
                </g>

                {/* X-axis */}
                <line x1={padLeft} x2={padLeft + chartWidth} y1={padTop + chartHeight} y2={padTop + chartHeight} stroke={axisColor} strokeWidth={2} />
                <text x={padLeft + chartWidth / 2} y={padTop + chartHeight + 55} textAnchor="middle" fill={textColor} fontSize={labelFontSize} fontWeight="600">
                  Token Position
                </text>

                {/* Highlight line + pos badge */}
                <line x1={highlightX} x2={highlightX} y1={padTop} y2={padTop + chartHeight} stroke={highlightLine} strokeWidth={3} strokeDasharray="8 6" opacity={0.8} />
                <g>
                  <rect x={highlightX - 25} y={padTop + chartHeight + 10} width={40} height={20} fill="rgba(168, 85, 247, 0.9)" rx={4} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
                  <text x={highlightX - 5} y={padTop + chartHeight + 24} textAnchor="middle" fill="white" fontSize="12" fontWeight="600" fontFamily="ui-monospace, monospace">
                    {clampedHighlight}
                  </text>
                </g>

                {/* Waves */}
                {rows.map((row, idx) => (
                  <g key={idx}>
                    <path d={row.path} fill="none" stroke={row.kind === "sin" ? "url(#sin-gradient)" : "url(#cos-gradient)"} strokeWidth={LINE_WIDTH} strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
                    <circle cx={highlightX} cy={row.yAtHighlight} r={5} fill={row.kind === "sin" ? waveSinEnd : waveCosEnd} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
                    <text x={padLeft + chartWidth + 25} y={row.centerY -10} fill={row.kind === "sin" ? waveSinEnd : waveCosEnd} fontSize={labelFontSize} style={{ fontFamily: "ui-monospace, monospace" }}>
                      {row.label}
                    </text>
                    <text x={padLeft + chartWidth + 25} y={row.centerY + 15} fill="#94a3b8" fontSize={labelFontSize} style={{ fontFamily: "ui-monospace, monospace" }}>
                      f ≈ {row.frequency.toExponential(1)}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
