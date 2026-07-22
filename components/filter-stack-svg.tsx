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
import { computeStampLayout } from "@/lib/rendering/stampLayout";
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
	const dateText = dateStr ?? "";

	// Shared with the export path (offscreenRenderer.tsx) so the stamp's
	// size/position can never disagree between preview and export, and so it
	// scales consistently — and never runs off-frame — across image sizes.
	const stampLayout = computeStampLayout(width, height, dateText);

	// Measure the date's real rendered width off the live text node for
	// crisp final positioning; the layout's own estimate (used above for the
	// shrink-to-fit decision) is the fallback until this effect runs.
	const dateTextRef = useRef<SVGTextElement>(null);
	const [dateTextWidth, setDateTextWidth] = useState(
		() => dateText.length * stampLayout.fontSize * 0.6
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
	}, [dateText, stampLayout.fontSize, dateTextWidth]);

	const grainId = `atom-grain-${idSuffix}`;
	const verticalsId = `atom-verticals-${idSuffix}`;
	const reflectionId = `atom-reflection-${idSuffix}`;
	const shadowId = `atom-shadow-${idSuffix}`;
	const toneFilterId = `atom-tone-${idSuffix}`;

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

	// Contrast, as CSS `contrast()` defines it: out = (in - 0.5) * amount + 0.5.
	const { brightness, contrast, saturate } = config.tone;
	const contrastIntercept = 0.5 - 0.5 * contrast;

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
		// Always fills its parent box (width/height: 100%) and preserves the
		// photo's aspect ratio via viewBox + preserveAspectRatio. Callers control
		// the actual on-screen size by sizing the parent element (see
		// Preview.tsx, which uses a CSS aspect-ratio box capped by max-height on
		// small screens) — auto-sizing an <svg> via width:auto/height:auto plus
		// max-height is inconsistently supported on mobile Safari, so we don't
		// rely on it here.
		<svg
			viewBox={`0 0 ${width} ${height}`}
			width={width}
			height={height}
			xmlns="http://www.w3.org/2000/svg"
			style={{ display: "block", width: "100%", height: "100%" }}
			preserveAspectRatio="xMidYMid meet"
		>
			<defs>
				{/*
				  Brightness/contrast/saturation as a native SVG filter rather than
				  CSS `filter: brightness() contrast() saturate()`. Mobile Safari has
				  historically been unreliable applying the CSS Filter Effects
				  functions to SVG content (especially once mix-blend-mode layers are
				  stacked on top), which is why the "Light" tab sliders could look
				  correct on desktop and barely register on an iPhone. feComponentTransfer
				  + feColorMatrix are baseline SVG 1.1 and render consistently across
				  engines, including older WebKit.
				*/}
				<filter id={toneFilterId} colorInterpolationFilters="sRGB">
					<feComponentTransfer>
						<feFuncR type="linear" slope={brightness} intercept={0} />
						<feFuncG type="linear" slope={brightness} intercept={0} />
						<feFuncB type="linear" slope={brightness} intercept={0} />
					</feComponentTransfer>
					<feComponentTransfer>
						<feFuncR type="linear" slope={contrast} intercept={contrastIntercept} />
						<feFuncG type="linear" slope={contrast} intercept={contrastIntercept} />
						<feFuncB type="linear" slope={contrast} intercept={contrastIntercept} />
					</feComponentTransfer>
					<feColorMatrix type="saturate" values={String(saturate)} />
				</filter>

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
				filter={`url(#${toneFilterId})`}
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
				<g transform={`rotate(${STAMP.rotationDeg} ${stampLayout.rightX} ${stampLayout.baselineY})`}>
					<text
						x={stampLayout.rightX - dateTextWidth - stampLayout.gapPx}
						y={stampLayout.baselineY}
						textAnchor="end"
						fill={STAMP.ink}
						fontFamily={STAMP.fontFamily}
						fontSize={stampLayout.fontSize}
						style={{ userSelect: "none", fontWeight: 500 }}
					>
						{STAMP.wordmark}
					</text>
					<text
						ref={dateTextRef}
						x={stampLayout.rightX}
						y={stampLayout.baselineY}
						textAnchor="end"
						fill={STAMP.ink}
						fontFamily={STAMP.fontFamily}
						fontSize={stampLayout.fontSize}
						style={{ userSelect: "none" }}
					>
						{dateText}
					</text>
				</g>
			)}
		</svg>
	);
}
