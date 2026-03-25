"use client";

import { ChangeEvent, DragEvent, useMemo, useState } from "react";
import { PDFDocument } from "pdf-lib";

type UploadedImage = {
  id: string;
  file: File;
  previewUrl: string;
};

type BookSize = "A5" | "B5";

const BOOK_SIZES = {
  A5: { width: 420, height: 595 },
  B5: { width: 516, height: 729 },
} as const;

const DEFAULT_PAGE_MARGIN = 20;
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg"];

export default function Home() {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [bookSize, setBookSize] = useState<BookSize>("A5");
  const [pageMargin, setPageMargin] = useState(DEFAULT_PAGE_MARGIN);
  const [errorMessage, setErrorMessage] = useState("");
  const [draggedImageId, setDraggedImageId] = useState<string | null>(null);

  const hasImages = useMemo(() => images.length > 0, [images]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const selectedFiles = Array.from(files);

    const validFiles = selectedFiles.filter((file) =>
      ALLOWED_IMAGE_TYPES.includes(file.type)
    );
    const invalidFiles = selectedFiles.filter(
      (file) => !ALLOWED_IMAGE_TYPES.includes(file.type)
    );

    if (invalidFiles.length > 0) {
      setErrorMessage("PNG / JPG 以外の画像は今は読み込めません。");
    } else {
      setErrorMessage("");
    }

    const newImages: UploadedImage[] = validFiles.map((file) => ({
      id: `${file.name}-${file.lastModified}-${Math.random()}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setImages((prev) => [...prev, ...newImages]);

    event.target.value = "";
  };

  const handleRemoveImage = (id: string) => {
    setImages((prev) => {
      const target = prev.find((image) => image.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((image) => image.id !== id);
    });
  };

  const handleClearAll = () => {
    images.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    setImages([]);
    setErrorMessage("");
  };

  const handleExportPdf = async () => {
    if (images.length === 0) return;

    try {
      const pdfDoc = await PDFDocument.create();
      const { width: pageWidth, height: pageHeight } = BOOK_SIZES[bookSize];

      for (const image of images) {
        const page = pdfDoc.addPage([pageWidth, pageHeight]);

        const fileBytes = await image.file.arrayBuffer();
        let embeddedImage;

        if (
          image.file.type === "image/jpeg" ||
          image.file.type === "image/jpg"
        ) {
          embeddedImage = await pdfDoc.embedJpg(fileBytes);
        } else {
          embeddedImage = await pdfDoc.embedPng(fileBytes);
        }

        const imageWidth = embeddedImage.width;
        const imageHeight = embeddedImage.height;

        const maxWidth = pageWidth - pageMargin * 2;
        const maxHeight = pageHeight - pageMargin * 2;

        const widthScale = maxWidth / imageWidth;
        const heightScale = maxHeight / imageHeight;
        const scale = Math.min(widthScale, heightScale);

        const drawWidth = imageWidth * scale;
        const drawHeight = imageHeight * scale;

        const x = (pageWidth - drawWidth) / 2;
        const y = (pageHeight - drawHeight) / 2;

        page.drawImage(embeddedImage, {
          x,
          y,
          width: drawWidth,
          height: drawHeight,
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `doujin-book-${bookSize}.pdf`;
      link.click();

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("PDFの書き出しに失敗しました。");
    }
  };

  const moveImage = (index: number, direction: "up" | "down") => {
    setImages((prev) => {
      const newImages = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;

      if (targetIndex < 0 || targetIndex >= newImages.length) {
        return prev;
      }

      [newImages[index], newImages[targetIndex]] = [
        newImages[targetIndex],
        newImages[index],
      ];

      return newImages;
    });
  };

  const handleDragStart = (id: string) => {
    setDraggedImageId(id);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDrop = (targetId: string) => {
    if (!draggedImageId || draggedImageId === targetId) return;

    setImages((prev) => {
      const newImages = [...prev];
      const draggedIndex = newImages.findIndex(
        (image) => image.id === draggedImageId
      );
      const targetIndex = newImages.findIndex((image) => image.id === targetId);

      if (draggedIndex === -1 || targetIndex === -1) {
        return prev;
      }

      const [draggedItem] = newImages.splice(draggedIndex, 1);
      newImages.splice(targetIndex, 0, draggedItem);

      return newImages;
    });

    setDraggedImageId(null);
  };

  const handleDragEnd = () => {
    setDraggedImageId(null);
  };

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">
            同人誌まとめ本アプリ
          </h1>
          <p className="mt-3 text-gray-600">
            画像をまとめて選び、同人誌用PDFを作るための土台を作っています。
          </p>
        </header>

        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                画像アップロード
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                PNG / JPG の画像を複数選択できます。
              </p>

              <div className="mt-4">
                <p className="mb-2 text-sm font-medium text-gray-700">
                  本のサイズ
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setBookSize("A5")}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                      bookSize === "A5"
                        ? "bg-black text-white"
                        : "border border-gray-300 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    A5
                  </button>

                  <button
                    type="button"
                    onClick={() => setBookSize("B5")}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                      bookSize === "B5"
                        ? "bg-black text-white"
                        : "border border-gray-300 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    B5
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <p className="mb-2 text-sm font-medium text-gray-700">余白</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPageMargin(DEFAULT_PAGE_MARGIN)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                      pageMargin > 0
                        ? "bg-black text-white"
                        : "border border-gray-300 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    あり
                  </button>

                  <button
                    type="button"
                    onClick={() => setPageMargin(0)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                      pageMargin === 0
                        ? "bg-black text-white"
                        : "border border-gray-300 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    なし
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-black px-4 py-2 text-sm font-medium text-white transition hover:opacity-90">
                画像を選ぶ
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>

              <button
                type="button"
                onClick={handleClearAll}
                disabled={!hasImages}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                全削除
              </button>

              <button
                type="button"
                onClick={handleExportPdf}
                disabled={!hasImages}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                PDFを書き出す
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              選択した画像
            </h2>
            <p className="text-sm text-gray-600">
              {images.length} 枚 / {bookSize} / 余白 {pageMargin === 0 ? "なし" : "あり"}
            </p>
          </div>

          {!hasImages ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">
              まだ画像が選ばれていません
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {images.map((image, index) => (
                <div
                  key={image.id}
                  draggable
                  onDragStart={() => handleDragStart(image.id)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(image.id)}
                  onDragEnd={handleDragEnd}
                  className={`overflow-hidden rounded-2xl bg-white shadow-sm ring-1 transition ${
                    draggedImageId === image.id
                      ? "opacity-50 ring-blue-400"
                      : "ring-gray-200"
                  }`}
                >
                  <div className="aspect-[3/4] bg-gray-100">
                    <img
                      src={image.previewUrl}
                      alt={image.file.name}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="p-3">
                    <p className="mb-1 text-xs font-semibold text-gray-500">
                      ページ {index + 1}
                    </p>
                    <p className="truncate text-sm font-medium text-gray-900">
                      {image.file.name}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {(image.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>

                    <p className="mt-2 text-xs text-gray-400">
                      ドラッグでも並び替えできます
                    </p>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => moveImage(index, "up")}
                        disabled={index === 0}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        1P前へ
                      </button>

                      <button
                        type="button"
                        onClick={() => moveImage(index, "down")}
                        disabled={index === images.length - 1}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        1P後ろへ
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveImage(image.id)}
                        className="col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-100"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}