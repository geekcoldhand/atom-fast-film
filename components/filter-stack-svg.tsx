"use client";

/**
 * components/filter-stack-svg.tsx  (the unified engine)
 *
 * ONE React component. Native <svg> + <rect>/<pattern>/<image>/<text>,
 * styled with mix-blend-mode via inline style (SVG supports the CSS
 * Compositing spec identically to HTML). No <foreignObject>, ever (§3.1).
 *
 * - Preview mounts this directly in the page, sized responsively.
 * - Export mounts the EXACT same component off-screen at natural resolution,
 *   serializes it with XMLSerializer, and rasterizes the string.
 *
 * There is one component, one file, one place to add a layer. Layer order
 * :  base → blueBase → cyanLift → reflection → grain → verticals →
 * shadowControl → stamp.
 */

import { useLayoutEffect, useRef, useState } from "react";
import {
	GRAIN,
	GRAIN_DATA_URI,
	STAMP,
	VERTICALS,
} from "@/lib/rendering/constants";
import {
	buildFilterConfig,
	type GradientStop,
} from "@/lib/rendering/filterConfig";
import type { Controls } from "@/lib/constants/controls";

interface FilterStackSvgProps {
	imgSrc: string;
	controls: Controls;
	width: number;
	height: number;
	showStamp?: boolean;
	dateStr?: string;
	/** unique suffix so multiple instances (preview + off-screen export) don't
	 *  collide on <defs> ids in the same document. */
	idSuffix?: string;
}

/** monospace width estimate — a good initial value so the stamp never flashes
 *  overlapped before getComputedTextLength refines it (§2.5 / §3.3). */
function monoEstimate(text: string, fontSize: number) {
	return text.length * fontSize * 0.6;
}

export function FilterStackSvg({
	imgSrc,
	controls,
	width,
	height,
	showStamp = true,
	dateStr,
	idSuffix = "live",
}: FilterStackSvgProps) {
	const config = buildFilterConfig(controls);

	const minSide = Math.min(width, height);
	const fontSize = Math.min(
		STAMP.fontSizeMax,
		Math.max(STAMP.fontSizeMin, minSide * STAMP.fontSizeFactor)
	);
	const gapPx = fontSize * STAMP.gapEm;
	const rightX = width - width * STAMP.rightPercent;
	const baselineY = height - height * STAMP.bottomPercent;
	const date = dateStr ?? "";

	// Measure the date's real rendered width off the live node (§3.3), falling
	// back to a monospace estimate until the layout effect runs.
	const dateRef = useRef<SVGTextElement>(null);
	const [dateLen, setDateLen] = useState(() => monoEstimate(date, fontSize));

	useLayoutEffect(() => {
		if (dateRef.current) {
			try {
				const len = dateRef.current.getComputedTextLength();
				if (len && Math.abs(len - dateLen) > 0.5) setDateLen(len);
			} catch {
				/* getComputedTextLength can throw if not yet laid out; keep estimate */
			}
		}
	}, [date, fontSize, dateLen]);

	const grainId = `atom-grain-${idSuffix}`;
	const verticalsId = `atom-verticals-${idSuffix}`;
	const reflectionId = `atom-reflection-${idSuffix}`;
	const shadowId = `atom-shadow-${idSuffix}`;

	const verticalsStripWidth = (width * VERTICALS.stripePercent) / 100;
	const verticalsLineWidth = Math.max(
		0.5,
		verticalsStripWidth * VERTICALS.lineFraction
	);
	const grainTile = (width * GRAIN.tilePercent) / 100;

	const gradToStops = (stops: GradientStop[], color: string) =>
		stops.map((s, i) => (
			<stop
				key={i}
				offset={s.offset}
				stopColor={color}
				stopOpacity={s.opacity}
			/>
		));

	return (
		<svg
			viewBox={`0 0 ${width} ${height}`}
			width={width}
			height={height}
			xmlns="http://www.w3.org/2000/svg"
			style={{ display: "block", width: "100%", height: "auto" }}
			preserveAspectRatio="xMidYMid meet"
		>
			<defs>
				<pattern
					id={grainId} //grain
					patternUnits="userSpaceOnUse"
					width={grainTile}
					height={grainTile}
				>
					<image
						href={GRAIN_DATA_URI}
						width={grainTile}
						height={grainTile}
						preserveAspectRatio="none"
					/>
				</pattern>

				<pattern
					id={verticalsId} //verticals
					patternUnits="userSpaceOnUse"
					width={verticalsStripWidth}
					height={height}
				>
					<rect
						x={0}
						y={0}
						width={verticalsLineWidth}
						height={height}
						fill={VERTICALS.lineColor}
					/>
				</pattern>

				<linearGradient id={reflectionId} x1="0" y1="0" x2="0" y2="1">
					{gradToStops(
						config.layers.reflection.stops,
						config.layers.reflection.color
					)}
				</linearGradient>

				<radialGradient id={shadowId} cx="0.5" cy="0.5" r="0.75">
					{gradToStops(
						config.layers.shadowControl.stops,
						config.layers.shadowControl.color
					)}
				</radialGradient>
			</defs>

			{/* base */}
			<image
				href={imgSrc}
				x={0}
				y={0}
				width={width}
				height={height}
				preserveAspectRatio="xMidYMid slice"
				style={{ filter: config.baseFilter }}
			/>

			{/* blueBase */}
			<rect
				width={width}
				height={height}
				fill={config.layers.blueBase.color}
				style={{
					mixBlendMode: config.layers.blueBase.blend as never,
					opacity: config.layers.blueBase.opacity,
				}}
			/>

			{/* cyanLift */}
			<rect
				width={width}
				height={height}
				fill={config.layers.cyanLift.color}
				style={{
					mixBlendMode: config.layers.cyanLift.blend as never,
					opacity: config.layers.cyanLift.opacity,
				}}
			/>

			{/* reflection */}
			<rect
				width={width}
				height={height}
				fill={`url(#${reflectionId})`}
				style={{
					mixBlendMode: config.layers.reflection.blend as never,
					opacity: config.layers.reflection.opacity,
				}}
			/>

			{/* grain */}
			<rect
				width={width}
				height={height}
				fill={`url(#${grainId})`}
				style={{
					mixBlendMode: config.layers.grain.blend as never,
					opacity: config.layers.grain.opacity,
				}}
			/>

			{/* verticals */}
			<rect
				width={width}
				height={height}
				fill={`url(#${verticalsId})`}
				style={{
					mixBlendMode: config.layers.verticals.blend as never,
					opacity: config.layers.verticals.opacity,
				}}
			/>

			{/* shadowControl */}
			<rect
				width={width}
				height={height}
				fill={`url(#${shadowId})`}
				style={{
					mixBlendMode: config.layers.shadowControl.blend as never,
					opacity: config.layers.shadowControl.opacity,
				}}
			/>

			{/* stamp */}
			{showStamp && date && (
				<g transform={`rotate(${STAMP.rotationDeg} ${rightX} ${baselineY})`}>
					<text
						x={rightX - dateLen - gapPx}
						y={baselineY}
						textAnchor="end"
						fill={STAMP.ink}
						fontFamily={STAMP.fontFamily}
						fontSize={fontSize}
						style={{ userSelect: "none", fontWeight: 500 }}
					>
						{STAMP.wordmark}
					</text>
					<text
						ref={dateRef}
						x={rightX}
						y={baselineY}
						textAnchor="end"
						fill={STAMP.ink}
						fontFamily={STAMP.fontFamily}
						fontSize={fontSize}
						style={{ userSelect: "none" }}
					>
						{date}
					</text>
				</g>
			)}
		</svg>
	);
}
