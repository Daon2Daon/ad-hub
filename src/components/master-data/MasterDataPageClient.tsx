"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";

import {
  createMasterDataItemAction,
  deleteMasterDataItemAction,
  updateMasterDataItemAction,
} from "@/lib/master-data/actions";
import { cn } from "@/lib/utils";
import type {
  MasterDataCategory,
  MasterDataItem,
  MasterDataCategoryMeta,
} from "@/types/master-data";

interface MasterDataPageClientProps {
  categories: MasterDataCategoryMeta[];
  initialItems: Record<MasterDataCategory, MasterDataItem[]>;
}

type MasterDataMap = Record<MasterDataCategory, MasterDataItem[]>;

export const MasterDataPageClient = ({ categories, initialItems }: MasterDataPageClientProps) => {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<MasterDataCategory>(categories[0].key);
  const [items, setItems] = useState<MasterDataMap>(initialItems);
  const [newValue, setNewValue] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const currentMeta = useMemo(
    () => categories.find((category) => category.key === selectedCategory)!,
    [categories, selectedCategory],
  );

  const currentItems = items[selectedCategory] ?? [];

  const { execute: createItem, isExecuting: isCreating } = useAction(createMasterDataItemAction, {
    onSuccess: ({ data }) => {
      if (!data) {
        return;
      }
      setItems((prev) => ({
        ...prev,
        [data.item.category]: sortItems([...(prev[data.item.category] ?? []), data.item]),
      }));
      setNewValue("");
      setFeedback(null);
      // 다른 페이지들도 최신 마스터 데이터를 가져오도록 새로고침
      router.refresh();
    },
    onError: ({ error }) => {
      const message =
        typeof error.serverError === "string" ? error.serverError : "등록에 실패했습니다.";
      setFeedback(message);
    },
  });

  const { execute: updateItem, isExecuting: isUpdating } = useAction(updateMasterDataItemAction, {
    onSuccess: ({ data }) => {
      if (!data) {
        return;
      }

      setItems((prev) => ({
        ...prev,
        [data.item.category]: sortItems(
          (prev[data.item.category] ?? []).map((item) =>
            item.id === data.item.id ? data.item : item,
          ),
        ),
      }));
      setEditId(null);
      setEditValue("");
      
      // 업데이트된 캠페인 수 표시
      if (data.updatedCampaigns > 0) {
        setFeedback(
          `마스터 데이터가 수정되었고, 관련 캠페인 ${data.updatedCampaigns}건도 함께 업데이트되었습니다.`,
        );
      } else {
        setFeedback(null);
      }
      
      // 다른 페이지들도 최신 마스터 데이터를 가져오도록 새로고침
      router.refresh();
    },
    onError: ({ error }) => {
      const message =
        typeof error.serverError === "string" ? error.serverError : "수정에 실패했습니다.";
      setFeedback(message);
    },
  });

  const { execute: deleteItem, isExecuting: isDeleting } = useAction(deleteMasterDataItemAction, {
    onSuccess: ({ data }) => {
      if (!data) {
        return;
      }

      setItems((prev) => {
        const category = selectedCategory;
        return {
          ...prev,
          [category]: (prev[category] ?? []).filter((item) => item.id !== data.id),
        };
      });
      setFeedback(null);
      // 다른 페이지들도 최신 마스터 데이터를 가져오도록 새로고침
      router.refresh();
    },
    onError: ({ error }) => {
      const message =
        typeof error.serverError === "string" ? error.serverError : "삭제에 실패했습니다.";
      setFeedback(message);
    },
  });

  const handleCreate = () => {
    if (!newValue.trim()) {
      setFeedback("추가할 값을 입력해주세요.");
      return;
    }

    createItem({
      category: selectedCategory,
      value: newValue.trim(),
    });
  };

  const handleUpdate = (id: string) => {
    if (!editValue.trim()) {
      setFeedback("수정할 값을 입력해주세요.");
      return;
    }

    updateItem({
      id,
      value: editValue.trim(),
    });
  };

  const startEditing = (item: MasterDataItem) => {
    setEditId(item.id);
    setEditValue(item.value);
    setFeedback(null);
  };

  const cancelEditing = () => {
    setEditId(null);
    setEditValue("");
  };

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category.key}
            type="button"
            onClick={() => {
              setSelectedCategory(category.key);
              setNewValue("");
              setEditId(null);
              setEditValue("");
              setFeedback(null);
            }}
            className={cn(
              "rounded-xl border px-4 py-2 text-sm font-semibold transition",
              category.key === selectedCategory
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
            )}
          >
            {category.label}
          </button>
        ))}
      </div>

      <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">{currentMeta.label}</h2>
          <p className="text-sm text-slate-600">{currentMeta.description}</p>
        </header>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            value={newValue}
            onChange={(event) => setNewValue(event.target.value)}
            placeholder={currentMeta.placeholder}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            disabled={isCreating}
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={isCreating}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-semibold transition",
              isCreating
                ? "cursor-not-allowed bg-slate-200 text-slate-500"
                : "bg-slate-900 text-white hover:bg-slate-800",
            )}
          >
            추가
          </button>
        </div>

        {feedback ? (
          <div className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {feedback}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  값
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  액션
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentItems.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-sm text-slate-500">
                    등록된 값이 없습니다. 새로운 값을 추가해보세요.
                  </td>
                </tr>
              ) : (
                currentItems.map((item) => {
                  const isEditing = editId === item.id;
                  return (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {isEditing ? (
                          <input
                            value={editValue}
                            onChange={(event) => setEditValue(event.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                            disabled={isUpdating}
                          />
                        ) : (
                          item.value
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleUpdate(item.id)}
                                disabled={isUpdating}
                                className={cn(
                                  "rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition",
                                  isUpdating && "cursor-not-allowed opacity-70",
                                )}
                              >
                                저장
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditing}
                                disabled={isUpdating}
                                className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 transition hover:border-slate-300 hover:bg-slate-50"
                              >
                                취소
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startEditing(item)}
                                className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                              >
                                수정
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteItem({ id: item.id })}
                                disabled={isDeleting}
                                className={cn(
                                  "rounded-lg border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-50",
                                  isDeleting && "cursor-not-allowed opacity-70",
                                )}
                              >
                                삭제
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
};

function sortItems(items: MasterDataItem[]): MasterDataItem[] {
  return [...items].sort((a, b) => a.value.localeCompare(b.value, "ko"));
}
