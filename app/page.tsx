"use client";

/**
 * ATOM — Cyanotype Film Filter (App shell, Setup App.jsx)
 *
 * Owns app state (imgSrc, controls, processing) and the four handlers the
 * spec's App wires up. Preview + export both render the one FilterStackSvg
 * engine; this file never touches paint math.
 */

import { useCallback, useMemo, useState } from "react";
import { Header } from "@/components/header";
import { Preview } from "@/components/preview";
import { Controls } from "@/components/controls";
import { ProcessingOverlay } from "@/components/processing-overlay";
import {
	DEFAULT_CONTROLS,
	type ControlKey,
	type Controls as ControlsType,
} from "@/lib/constants/controls";
import { renderToBlob } from "@/lib/export/renderToBlob";
import { saveBlob } from "@/lib/export/saveBlob";

function formatDate(d: Date) {
	const p = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

export default function Page() {
	const [imgSrc, setImgSrc] = useState<string | null>(null);
	const [size, setSize] = useState<{ w: number; h: number } | null>(null);
	const [controls, setControls] = useState<ControlsType>({
		...DEFAULT_CONTROLS,
	});
	const [isProcessing, setIsProcessing] = useState(false);

	const dateStr = useMemo(() => formatDate(new Date()), []);

	const updateControl = useCallback((key: ControlKey, value: number) => {
		setControls((prev) => ({ ...prev, [key]: value }));
	}, []);

	const handleFile = useCallback((file: File) => {
		const reader = new FileReader();
		reader.onload = () => {
			const dataUrl = reader.result as string;
			// Measure natural dimensions so the SVG viewBox matches the source.
			const img = new Image();
			img.crossOrigin = "anonymous";
			img.onload = () => {
				setSize({ w: img.naturalWidth, h: img.naturalHeight });
				setImgSrc(dataUrl);
			};
			img.src = dataUrl;
		};
		reader.readAsDataURL(file);
	}, []);

	const handleReset = useCallback(() => {
		setImgSrc(null);
		setSize(null);
	}, []);

	const handleExport = useCallback(async () => {
		if (!imgSrc || !size || isProcessing) return;
		setIsProcessing(true);
		try {
			const blob = await renderToBlob({
				imgSrc,
				controls,
				width: size.w,
				height: size.h,
				dateStr,
			});
			saveBlob(blob, `atom-${dateStr.replace(/\./g, "")}.jpg`);
		} catch (err) {
			console.log("[v0] export failed:", (err as Error).message);
		} finally {
			setIsProcessing(false);
		}
	}, [imgSrc, size, controls, dateStr, isProcessing]);

	return (
		<div className="flex h-dvh flex-col bg-atom-bg">
			<Header
				hasImage={!!imgSrc}
				processing={isProcessing}
				onSave={handleExport}
			/>

			<Preview
				imgSrc={imgSrc}
				size={size}
				controls={controls}
				dateStr={dateStr}
				onFile={handleFile}
			/>

			{imgSrc && (
				<div className="flex justify-center px-4 pb-1">
					<button
						type="button"
						onClick={handleReset}
						className="font-mono text-[10px] uppercase tracking-[0.25em] text-atom-muted transition-colors hover:text-atom-text"
					>
						Replace image
					</button>
				</div>
			)}

			<Controls controls={controls} onChange={updateControl} />

			{isProcessing && <ProcessingOverlay />}
		</div>
	);
}
