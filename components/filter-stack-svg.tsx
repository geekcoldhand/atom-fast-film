"use client";

/**
 * components/filter-stack-svg.tsx (the unified rendering engine)
 *
 * One React component, native <svg> + <rect>/<pattern>/<image>/<text>,
 * styled with mix-blend-mode via inline style. No <foreignObject> — that
 * would permanently taint the export canvas.
 *
 * - The live preview mounts this directly in the page.
 * - Export mounts the exact same component off-screen at full resolution,
 *   serializes it with XMLSerializer, and rasterizes the result.
 *
 * Layer paint order: base photo -> blueBase -> cyanLift -> reflection ->
 * grain -> verticals -> shadowControl -> date stamp.
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
	/**
	 * Display-only: caps the rendered height so a tall portrait photo stays
	 * inside the viewport on small screens instead of pushing the controls
	 * off-screen. Must default to false and NEVER be passed from the export
	 * path (offscreenRenderer.tsx) — this component's markup is serialized
	 * verbatim for export, so any inline style set here would be baked into
	 * the exported SVG too. The width/height props (natural pixel
	 * resolution) are unaffected either way; this only scales the on-screen
	 * CSS box.
	 */
	constrainToViewport?: boolean;
}

/** Rough monospace width estimate used as the initial stamp position before
 *  `getComputedTextLength` (below) measures the real rendered width. */
function estimateMonospaceTextWidth(text: string, fontSize: number) {
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
	constrainToViewport = false,
}: FilterStackSvgProps) {
	const config = buildFilterConfig(controls);

	const stampFrameShorterSide = Math.min(width, height);
	const stampFontSize = Math.min(
		STAMP.fontSizeMax,
		Math.max(STAMP.fontSizeMin, stampFrameShorterSide * STAMP.fontSizeFactor)
	);
	const stampGapPx = stampFontSize * STAMP.gapEm;
	const stampRightX = width - width * STAMP.rightPercent;
	const stampBaselineY = height - height * STAMP.bottomPercent;
	const dateText = dateStr ?? "";

	// Measure the date's real rendered width off the live text node, falling
	// back to a monospace estimate until the layout effect below runs.
	const dateTextRef = useRef<SVGTextElement>(null);
	const [dateTextWidth, setDateTextWidth] = useState(() =>
		estimateMonospaceTextWidth(dateText, stampFontSize)
	);

	useLayoutEffect(() => {
		if (dateTextRef.current) {
			try {
				const measuredWidth = dateTextRef.current.getComputedTextLength();
				if (measuredWidth && Math.abs(measuredWidth - dateTextWidth) > 0.5) {
					setDateTextWidth(measuredWidth);
				}
			} catch {
				/* getComputedTextLength can throw before layout has run; keep the estimate */
			}
		}
	}, [dateText, stampFontSize, dateTextWidth]);

	const grainId = `atom-grain-${idSuffix}`;
	const verticalsId = `atom-verticals-${idSuffix}`;
	const reflectionId = `atom-reflection-${idSuffix}`;
	const shadowId = `atom-shadow-${idSuffix}`;

	const verticalsStripWidth = (width * VERTICALS.stripePercent) / 100;
	const verticalsLineWidth = Math.max(
		0.5,
		verticalsStripWidth * VERTICALS.lineFraction
	);
	// Guard against a transient 0/NaN width (e.g. before the source image has
	// finished loading) producing an invalid, zero-size pattern tile.
	const rawGrainTileSize = (width * GRAIN.tilePercent) / 100;
	const grainTileSize =
		Number.isFinite(rawGrainTileSize) && rawGrainTileSize > 0
			? rawGrainTileSize
			: 1;

	const renderGradientStops = (stops: GradientStop[], color: string) =>
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
			style={
				constrainToViewport
					? { display: "block", width: "auto", height: "auto", maxWidth: "100%", maxHeight: "60vh" }
					: { display: "block", width: "100%", height: "auto" }
			}
			preserveAspectRatio="xMidYMid meet"
		>
			<defs>
				<pattern
					id={grainId} //grain
					patternUnits="userSpaceOnUse"
					width={grainTileSize}
					height={grainTileSize}
				>
					<image
						href={GRAIN_DATA_URI}
						width={grainTileSize}
						height={grainTileSize}
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
					{renderGradientStops(
						config.layers.reflection.stops,
						config.layers.reflection.color
					)}
				</linearGradient>

				<radialGradient id={shadowId} cx="0.5" cy="0.5" r="0.75">
					{renderGradientStops(
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
			{showStamp && dateText && (
				<g transform={`rotate(${STAMP.rotationDeg} ${stampRightX} ${stampBaselineY})`}>
					<text
						x={stampRightX - dateTextWidth - stampGapPx}
						y={stampBaselineY}
						textAnchor="end"
						fill={STAMP.ink}
						fontFamily={STAMP.fontFamily}
						fontSize={stampFontSize}
						style={{ userSelect: "none", fontWeight: 500 }}
					>
						{STAMP.wordmark}
					</text>
					<text
						ref={dateTextRef}
						x={stampRightX}
						y={stampBaselineY}
						textAnchor="end"
						fill={STAMP.ink}
						fontFamily={STAMP.fontFamily}
						fontSize={stampFontSize}
						style={{ userSelect: "none" }}
					>
						{dateText}
					</text>
				</g>
			)}
		</svg>
	);
}
