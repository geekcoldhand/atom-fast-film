"use client";

/**
 * app/page.tsx — application shell
 *
 * Owns all app state (loaded photo, slider values, export-in-progress flag)
 * and the handlers for loading a file, resetting, and exporting. Preview and
 * export both render the same FilterStackSvg engine; this file never touches
 * paint math itself.
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

function formatDateStamp(date: Date) {
	const pad2 = (n: number) => String(n).padStart(2, "0");
	return `${date.getFullYear()}.${pad2(date.getMonth() + 1)}.${pad2(
		date.getDate()
	)}`;
}

export default function Page() {
	const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
	const [photoSize, setPhotoSize] = useState<{ w: number; h: number } | null>(
		null
	);
	const [controls, setControls] = useState<ControlsType>({
		...DEFAULT_CONTROLS,
	});
	const [isExporting, setIsExporting] = useState(false);

	const dateStr = useMemo(() => formatDateStamp(new Date()), []);

	const updateControl = useCallback((key: ControlKey, value: number) => {
		setControls((prev) => ({ ...prev, [key]: value }));
	}, []);

	const handleFileSelected = useCallback((file: File) => {
		const reader = new FileReader();
		reader.onload = () => {
			const dataUrl = reader.result as string;
			// Measure natural dimensions so the SVG viewBox matches the source.
			const probeImage = new Image();
			probeImage.crossOrigin = "anonymous";
			probeImage.onload = () => {
				setPhotoSize({
					w: probeImage.naturalWidth,
					h: probeImage.naturalHeight,
				});
				setPhotoDataUrl(dataUrl);
			};
			probeImage.src = dataUrl;
		};
		reader.readAsDataURL(file);
	}, []);

	const handleReset = useCallback(() => {
		setPhotoDataUrl(null);
		setPhotoSize(null);
	}, []);

	const handleExport = useCallback(async () => {
		if (!photoDataUrl || !photoSize || isExporting) return;
		setIsExporting(true);
		try {
			const blob = await renderToBlob({
				imgSrc: photoDataUrl,
				controls,
				width: photoSize.w,
				height: photoSize.h,
				dateStr,
			});
			saveBlob(blob, `atom-${dateStr.replace(/\./g, "")}.jpg`);
		} catch (err) {
			console.error("Export failed:", (err as Error).message);
		} finally {
			setIsExporting(false);
		}
	}, [photoDataUrl, photoSize, controls, dateStr, isExporting]);

	return (
		<div className="flex h-dvh flex-col bg-atom-bg overflow-x-hidden">
			<Header
				hasImage={!!photoDataUrl}
				processing={isExporting}
				onSave={handleExport}
			/>

			<Preview
				imgSrc={photoDataUrl}
				size={photoSize}
				controls={controls}
				dateStr={dateStr}
				onFile={handleFileSelected}
			/>

			{photoDataUrl && (
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

			{isExporting && <ProcessingOverlay />}
		</div>
	);
}
