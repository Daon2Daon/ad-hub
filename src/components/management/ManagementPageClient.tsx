"use client";

import { Dispatch, FormEvent, SetStateAction, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";

import {
  CampaignFormModal,
  EMPTY_CAMPAIGN_FORM_STATE,
  REQUIRED_CREATE_COLUMNS,
  type CampaignFormState,
} from "@/components/management/CampaignFormModal";
import {
  bulkUpdateCampaignsAction,
  bulkUploadCampaignsAction,
  createCampaignAction,
  deleteCampaignsAction,
  updateCampaignAction,
} from "@/lib/management/actions";
import { createTemplateCsv, downloadCsv } from "@/lib/management/csv";
import { mergeManagementOptions } from "@/lib/management/utils";
import { cn } from "@/lib/utils";
import type { ManagementColumnAccess, ManagementOptions, ManagementRow } from "@/types/management";

interface ManagementPageClientProps {
  rows: ManagementRow[];
  columnAccess: ManagementColumnAccess;
  options: ManagementOptions;
  totalSpend: number | null;
}

type FormMode = "create" | "edit";

const dateFormatter = (value: string | null) => {
  if (!value) {
    return "권한 없음";
  }

  try {
    return format(parseISO(value), "yyyy.MM.dd");
  } catch {
    return "권한 없음";
  }
};

const currencyFormatter = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

export const ManagementPageClient = ({
  rows,
  columnAccess,
  options,
  totalSpend,
}: ManagementPageClientProps) => {
  const router = useRouter();

  const [items, setItems] = useState<ManagementRow[]>(rows);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [optionSets, setOptionSets] = useState<ManagementOptions>(options);

  const [formMode, setFormMode] = useState<FormMode>("create");
  const [formOpen, setFormOpen] = useState(false);
  const [formState, setFormState] = useState<CampaignFormState>(EMPTY_CAMPAIGN_FORM_STATE);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [bulkUpdateOpen, setBulkUpdateOpen] = useState(false);
  const [bulkValues, setBulkValues] = useState({ department: "", agency: "" });

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof CampaignFormState, string>>>({});

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds],
  );

  const selectedSpend = useMemo(() => {
    if (!columnAccess.spend) {
      return null;
    }

    return selectedItems.reduce((acc, item) => acc + (item.spend ?? 0), 0);
  }, [selectedItems, columnAccess.spend]);

  const canCreate = REQUIRED_CREATE_COLUMNS.every((key) => columnAccess[key]);

  const canBulkUpdate = columnAccess.department || columnAccess.agency;

  const columnDescriptors = useMemo(
    () => [
      {
        key: "campaign" as const,
        label: "캠페인",
        visible: columnAccess.campaign,
        render: (row: ManagementRow) => row.campaign,
        align: "left" as const,
      },
      {
        key: "creative" as const,
        label: "소재",
        visible: columnAccess.creative,
        render: (row: ManagementRow) => row.creative,
        align: "left" as const,
      },
      {
        key: "channel" as const,
        label: "매체/구분",
        visible: columnAccess.channel,
        render: (row: ManagementRow) => row.channel,
        align: "left" as const,
      },
      {
        key: "schedule" as const,
        label: "일정",
        visible: columnAccess.schedule,
        render: (row: ManagementRow) =>
          row.startDate && row.endDate
            ? `${dateFormatter(row.startDate)} ~ ${dateFormatter(row.endDate)}`
            : "권한 없음",
        align: "left" as const,
      },
      {
        key: "spend" as const,
        label: "광고비",
        visible: columnAccess.spend,
        render: (row: ManagementRow) =>
          row.spend !== null ? currencyFormatter.format(row.spend) : "권한 없음",
        align: "right" as const,
      },
      {
        key: "budgetAccount" as const,
        label: "예산계정",
        visible: columnAccess.budgetAccount,
        render: (row: ManagementRow) => row.budgetAccount,
        align: "left" as const,
      },
      {
        key: "department" as const,
        label: "담당부서",
        visible: columnAccess.department,
        render: (row: ManagementRow) => row.department,
        align: "left" as const,
      },
      {
        key: "agency" as const,
        label: "대행사",
        visible: columnAccess.agency,
        render: (row: ManagementRow) => row.agency,
        align: "left" as const,
      },
    ],
    [columnAccess],
  );

  const visibleColumns = columnDescriptors.filter((column) => column.visible);

  const { execute: createCampaign, isExecuting: isCreating } = useAction(createCampaignAction, {
    onSuccess: ({ data }) => {
      if (!data) {
        return;
      }

      setItems((prev) => [...prev, data.row]);
      setOptionSets((prev) => mergeManagementOptions(prev, data.optionValues));
      setFormOpen(false);
      setFormState(EMPTY_CAMPAIGN_FORM_STATE);
      setActionError(null);
      setFieldErrors({});

      // 자동 생성된 마스터 데이터 정보 표시
      if (data.autoCreatedMasterData && data.autoCreatedMasterData.length > 0) {
        const categoryLabels: Record<string, string> = {
          campaign: "캠페인",
          creative: "소재",
          channel: "매체/구분",
          budgetAccount: "예산계정",
          department: "담당부서",
          agency: "대행사",
        };

        const autoCreatedList = data.autoCreatedMasterData
          .map((item) => `${categoryLabels[item.category]}: "${item.value}"`)
          .join(", ");
        setActionMessage(`자동 등록 완료: ${data.autoCreatedMasterData.length}개 (${autoCreatedList})`);
      } else {
        setActionMessage("등록이 완료되었습니다.");
      }

      router.refresh();
    },
    onError: ({ error }) => {
      setFieldErrors({});
      const message =
        typeof error.serverError === "string" ? error.serverError : "신규 등록에 실패했습니다.";
      
      // 마스터 데이터 관련 오류인 경우 필드별로 분리
      if (message.includes("마스터 데이터")) {
        // 오류 메시지에서 필드 정보 추출 시도
        // 예: "마스터 데이터에 등록되지 않은 값이 있습니다: 매체/구분: "유튜브""
        const fieldMap: Record<string, keyof CampaignFormState> = {
          캠페인: "campaign",
          소재: "creative",
          "매체/구분": "channel",
          예산계정: "budgetAccount",
          담당부서: "department",
          대행사: "agency",
        };

        const errors: Partial<Record<keyof CampaignFormState, string>> = {};
        Object.entries(fieldMap).forEach(([label, field]) => {
          if (message.includes(label)) {
            errors[field] = message;
          }
        });

        if (Object.keys(errors).length > 0) {
          setFieldErrors(errors);
        } else {
          setActionError(message);
        }
      } else {
        setActionError(message);
      }
    },
  });

  const { execute: updateCampaign, isExecuting: isUpdating } = useAction(updateCampaignAction, {
    onSuccess: ({ data }) => {
      if (!data) {
        return;
      }

      setItems((prev) => prev.map((item) => (item.id === data.row.id ? data.row : item)));
      setOptionSets((prev) => mergeManagementOptions(prev, data.optionValues));
      setFormOpen(false);
      setEditingId(null);
      setFormState(EMPTY_CAMPAIGN_FORM_STATE);
      setActionError(null);
      router.refresh();
    },
    onError: ({ error }) => {
      const message =
        typeof error.serverError === "string" ? error.serverError : "수정에 실패했습니다.";
      setActionError(message);
    },
  });

  const { execute: bulkUpdateCampaigns, isExecuting: isBulkUpdating } = useAction(
    bulkUpdateCampaignsAction,
    {
      onSuccess: ({ data }) => {
        if (!data) {
          return;
        }

        setItems((prev) =>
          prev.map((item) => {
            const next = data.rows.find((row) => row.id === item.id);
            return next ?? item;
          }),
        );
        setOptionSets((prev) => mergeManagementOptions(prev, data.optionValues));
        setBulkUpdateOpen(false);
        setBulkValues({ department: "", agency: "" });
        setSelectedIds(new Set());
        setActionError(null);
        router.refresh();
      },
      onError: ({ error }) => {
        const message =
          typeof error.serverError === "string" ? error.serverError : "일괄 변경에 실패했습니다.";
        setActionError(message);
      },
    },
  );

  const { execute: deleteCampaigns, isExecuting: isDeleting } = useAction(deleteCampaignsAction, {
    onSuccess: ({ data }) => {
      if (!data) {
        return;
      }

      setItems((prev) => prev.filter((item) => !data.ids.includes(item.id)));
      setSelectedIds(new Set());
      setPendingDeleteIds([]);
      setDeleteConfirmOpen(false);
      setActionError(null);
      router.refresh();
    },
    onError: ({ error }) => {
      const message =
        typeof error.serverError === "string" ? error.serverError : "삭제에 실패했습니다.";
      setActionError(message);
    },
  });

  const { execute: bulkUploadCampaigns, isExecuting: isUploading } = useAction(
    bulkUploadCampaignsAction,
    {
      onSuccess: ({ data }) => {
        if (!data) {
          return;
        }

        setItems((prev) => {
          const existingIds = new Set(prev.map((item) => item.id));
          const newItems = data.rows.filter((row) => !existingIds.has(row.id));
          const updatedItems = prev.map((item) => {
            const updated = data.rows.find((row) => row.id === item.id);
            return updated ?? item;
          });
          return [...updatedItems, ...newItems];
        });

        setOptionSets((prev) => {
          let merged = prev;
          data.optionValues.forEach((values) => {
            merged = mergeManagementOptions(merged, values);
          });
          return merged;
        });

        // 결과 메시지 구성
        const messages: string[] = [];
        if (data.successCount > 0) {
          messages.push(`성공: ${data.successCount}건`);
        }
        if (data.skippedCount > 0) {
          messages.push(`중복 건너뛰기: ${data.skippedCount}건`);
        }
        if (data.errorCount > 0) {
          messages.push(`실패: ${data.errorCount}건`);
        }

        // 자동 생성된 마스터 데이터 정보 추가
        if (data.autoCreatedMasterData && data.autoCreatedMasterData.length > 0) {
          const categoryLabels: Record<string, string> = {
            campaign: "캠페인",
            creative: "소재",
            channel: "매체/구분",
            budgetAccount: "예산계정",
            department: "담당부서",
            agency: "대행사",
          };

          // 너무 많으면 요약 표시
          if (data.autoCreatedMasterData.length > 5) {
            const categories = new Set(
              data.autoCreatedMasterData.map((item) => categoryLabels[item.category]),
            );
            messages.push(
              `자동 등록: ${data.autoCreatedMasterData.length}개 (${Array.from(categories).join(", ")} 등)`,
            );
          } else {
            const autoCreatedList = data.autoCreatedMasterData
              .map((item) => `${categoryLabels[item.category]}: "${item.value}"`)
              .join(", ");
            messages.push(`자동 등록: ${data.autoCreatedMasterData.length}개 (${autoCreatedList})`);
          }
        }

        if (messages.length > 0) {
          setActionMessage(messages.join(" / "));
          if (data.errors && data.errors.length > 0) {
            const errorMessage = data.errors.join("\n");
            setActionError(errorMessage);
            // 에러가 있으면 모달 내부에도 표시
            setUploadError(errorMessage);
          } else {
            setActionError(null);
            setUploadError(null);
          }
        } else {
          setActionMessage(null);
          setActionError(null);
          setUploadError(null);
        }

        // 에러가 없거나 일부 성공한 경우에만 모달 닫기
        if (!data.errors || data.errors.length === 0 || data.successCount > 0) {
          setUploadModalOpen(false);
          setUploadFile(null);
          setUploadError(null);
        }
        router.refresh();
      },
      onError: ({ error }) => {
        let message = "엑셀 업로드에 실패했습니다.";
        
        // next-safe-action의 에러 구조 확인
        if (error.serverError) {
          message = typeof error.serverError === "string" 
            ? error.serverError 
            : String(error.serverError);
        } else if (error.validationErrors) {
          const validationErrors = Object.values(error.validationErrors)
            .flat()
            .map((err) => {
              if (typeof err === "string") {
                return err;
              }
              if (err && typeof err === "object" && "_errors" in err && Array.isArray(err._errors)) {
                return err._errors.join(", ");
              }
              return String(err);
            })
            .join(", ");
          message = `입력값 검증 오류: ${validationErrors}`;
        } else if (error.thrownError) {
          message = `오류: ${error.thrownError.message || String(error.thrownError)}`;
        } else {
          // 모든 에러 정보를 문자열로 변환
          message = JSON.stringify(error, null, 2);
        }
        
        setActionMessage(null);
        setActionError(message);
        // 에러 발생 시 모달은 열어두고 에러 메시지를 모달 내부에 표시
        setUploadError(message);
      },
    },
  );

  const openCreateModal = () => {
    setFormMode("create");
    setFormState(EMPTY_CAMPAIGN_FORM_STATE);
    setEditingId(null);
    setActionError(null);
    setFieldErrors({});
    setFormOpen(true);
  };

  const openEditModal = (row: ManagementRow) => {
    setFormMode("edit");
    setEditingId(row.id);
    setActionError(null);
    setFieldErrors({});
    setFormState({
      campaign: columnAccess.campaign && row.campaign !== "권한 없음" ? row.campaign : "",
      creative: columnAccess.creative && row.creative !== "권한 없음" ? row.creative : "",
      channel: columnAccess.channel && row.channel !== "권한 없음" ? row.channel : "",
      budgetAccount:
        columnAccess.budgetAccount && row.budgetAccount !== "권한 없음" ? row.budgetAccount : "",
      department: columnAccess.department && row.department !== "권한 없음" ? row.department : "",
      agency: columnAccess.agency && row.agency !== "권한 없음" ? row.agency : "",
      startDate: columnAccess.schedule && row.startDate ? row.startDate.slice(0, 10) : "",
      endDate: columnAccess.schedule && row.endDate ? row.endDate.slice(0, 10) : "",
      spend: columnAccess.spend && row.spend !== null ? String(row.spend) : "0",
    });
    setFormOpen(true);
  };

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError(null);

    const formData = new FormData(event.currentTarget);

    if (formMode === "create") {
      const startValue = formData.get("startDate")?.toString() ?? "";
      const endValue = formData.get("endDate")?.toString() ?? "";

      const payload = {
        campaign: formData.get("campaign")?.toString().trim() ?? "",
        creative: formData.get("creative")?.toString().trim() || undefined,
        channel: formData.get("channel")?.toString().trim() ?? "",
        budgetAccount: formData.get("budgetAccount")?.toString().trim() || undefined,
        department: formData.get("department")?.toString().trim() ?? "",
        agency: formData.get("agency")?.toString().trim() ?? "",
        startDate: new Date(startValue),
        endDate: new Date(endValue),
        spend: Number(formData.get("spend")?.toString() ?? 0),
      };

      createCampaign(payload);
      return;
    }

    if (!editingId) {
      setActionError("수정할 캠페인이 지정되지 않았습니다.");
      return;
    }

    const startValue = formData.get("startDate")?.toString();
    const endValue = formData.get("endDate")?.toString();

    const payload = {
      id: editingId,
      campaign: columnAccess.campaign
        ? formData.get("campaign")?.toString().trim() || undefined
        : undefined,
      creative: columnAccess.creative
        ? formData.get("creative")?.toString().trim() || undefined
        : undefined,
      channel: columnAccess.channel
        ? formData.get("channel")?.toString().trim() || undefined
        : undefined,
      budgetAccount: columnAccess.budgetAccount
        ? formData.get("budgetAccount")?.toString().trim() || undefined
        : undefined,
      department: columnAccess.department
        ? formData.get("department")?.toString().trim() || undefined
        : undefined,
      agency: columnAccess.agency
        ? formData.get("agency")?.toString().trim() || undefined
        : undefined,
      startDate: columnAccess.schedule && startValue ? new Date(startValue) : undefined,
      endDate: columnAccess.schedule && endValue ? new Date(endValue) : undefined,
      spend:
        columnAccess.spend && formData.get("spend") !== null
          ? Number(formData.get("spend")!.toString())
          : undefined,
    };

    updateCampaign(payload);
  };

  const handleBulkUpdateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError(null);

    const ids = Array.from(selectedIds);

    const payload = {
      ids,
      department: columnAccess.department ? bulkValues.department.trim() || undefined : undefined,
      agency: columnAccess.agency ? bulkValues.agency.trim() || undefined : undefined,
    };

    bulkUpdateCampaigns(payload);
  };

  const handleDelete = (ids: string[]) => {
    setActionError(null);
    deleteCampaigns({ ids });
  };

  const handleTemplateDownload = () => {
    const template = createTemplateCsv();
    const filename = `campaign-template-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsv(template, filename);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadFile(file);
      setUploadError(null);
      setActionError(null);
    }
  };

  const handleUploadSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUploadError(null);
    setActionError(null);

    if (!uploadFile) {
      setUploadError("파일을 선택해주세요.");
      return;
    }

    // 파일 크기 체크 (10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (uploadFile.size > MAX_FILE_SIZE) {
      setUploadError(`파일 크기가 너무 큽니다. 최대 ${MAX_FILE_SIZE / 1024 / 1024}MB까지 업로드 가능합니다.`);
      return;
    }

    try {
      const text = await uploadFile.text();
      bulkUploadCampaigns({ csvContent: text });
    } catch (error) {
      const message = error instanceof Error ? error.message : "파일을 읽는 중 오류가 발생했습니다.";
      setUploadError(message);
    }
  };

  const toggleRowSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAllSelection = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(items.map((item) => item.id)));
      return;
    }

    setSelectedIds(new Set());
  };

  const openDeleteModal = (ids: string[]) => {
    setPendingDeleteIds(ids);
    setDeleteConfirmOpen(true);
    setActionError(null);
  };

  const activeFormTitle = formMode === "create" ? "신규 등록" : "데이터 수정";

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openCreateModal}
              disabled={!canCreate}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-semibold transition",
                canCreate
                  ? "bg-slate-900 text-white hover:bg-slate-800"
                  : "cursor-not-allowed bg-slate-200 text-slate-500",
              )}
            >
              신규 등록
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setBulkUpdateOpen(true)}
                disabled={!canBulkUpdate || selectedIds.size === 0}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-semibold transition",
                  canBulkUpdate && selectedIds.size > 0
                    ? "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                    : "cursor-not-allowed bg-slate-200 text-slate-500",
                )}
              >
                일괄 변경
              </button>
              <button
                type="button"
                onClick={() => openDeleteModal(Array.from(selectedIds))}
                disabled={selectedIds.size === 0}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-semibold transition",
                  selectedIds.size > 0
                    ? "bg-rose-600 text-white hover:bg-rose-500"
                    : "cursor-not-allowed bg-slate-200 text-slate-500",
                )}
              >
                일괄 삭제
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <button
              type="button"
              onClick={() => setUploadModalOpen(true)}
              className="rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
              엑셀 업로드
            </button>
            <button
              type="button"
              onClick={handleTemplateDownload}
              className="rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
              템플릿 다운로드
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <span>총 {items.length.toLocaleString("ko-KR")}건</span>
          {columnAccess.spend && totalSpend !== null ? (
            <span>총 광고비: {currencyFormatter.format(totalSpend)}</span>
          ) : null}
        </div>

        {actionMessage ? (
          <p className="rounded-lg border border-green-100 bg-green-50 px-4 py-2 text-sm text-green-700">
            {actionMessage}
          </p>
        ) : null}
        {actionError ? (
          <p className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-2 text-sm text-amber-700">
            {actionError}
          </p>
        ) : null}

        {selectedIds.size > 0 ? (
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-600">
            선택된 항목 {selectedIds.size.toLocaleString("ko-KR")}건
            {selectedSpend !== null
              ? ` · 선택 광고비 총합 ${currencyFormatter.format(selectedSpend)}`
              : ""}
          </div>
        ) : null}
      </header>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th
                  scope="col"
                  className="w-12 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                    checked={selectedIds.size > 0 && selectedIds.size === items.length}
                    onChange={(event) => toggleAllSelection(event.target.checked)}
                    aria-label="전체 선택"
                  />
                </th>
                {visibleColumns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={cn(
                      "px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500",
                      column.align === "right" ? "text-right" : "text-left",
                    )}
                  >
                    {column.label}
                  </th>
                ))}
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  액션
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleColumns.length + 2}
                    className="px-4 py-10 text-center text-sm text-slate-500"
                  >
                    표시할 캠페인 데이터가 없습니다. 신규 데이터를 등록하거나 권한을 확인해주세요.
                  </td>
                </tr>
              ) : (
                items.map((row) => {
                  const isSelected = selectedIds.has(row.id);

                  return (
                    <tr key={row.id} className={cn(isSelected && "bg-slate-50")}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                          checked={isSelected}
                          onChange={() => toggleRowSelection(row.id)}
                          aria-label={`${row.campaign} 선택`}
                        />
                      </td>
                      {visibleColumns.map((column) => (
                        <td
                          key={column.key}
                          className={cn(
                            "px-4 py-3 text-sm text-slate-700",
                            column.align === "right" ? "text-right" : "text-left",
                          )}
                        >
                          {column.render(row)}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(row)}
                            className={cn(
                              "rounded-lg border px-3 py-1 text-xs font-semibold transition",
                              "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                            )}
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => openDeleteModal([row.id])}
                            className="rounded-lg border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-50"
                          >
                            삭제
                          </button>
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

      <CampaignFormModal
        open={formOpen}
        mode={formMode}
        onClose={() => {
          setFormOpen(false);
          setEditingId(null);
          setFormState(EMPTY_CAMPAIGN_FORM_STATE);
          setActionError(null);
          setFieldErrors({});
        }}
        onSubmit={handleFormSubmit}
        formState={formState}
        setFormState={setFormState}
        columnAccess={columnAccess}
        options={optionSets}
        isSubmitting={formMode === "create" ? isCreating : isUpdating}
        title={activeFormTitle}
        fieldErrors={fieldErrors}
      />

      <BulkUpdateModal
        open={bulkUpdateOpen}
        onClose={() => {
          setBulkUpdateOpen(false);
          setBulkValues({ department: "", agency: "" });
        }}
        onSubmit={handleBulkUpdateSubmit}
        values={bulkValues}
        setValues={setBulkValues}
        columnAccess={columnAccess}
        options={optionSets}
        disabled={selectedIds.size === 0}
        isSubmitting={isBulkUpdating}
      />

      <DeleteConfirmModal
        open={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setPendingDeleteIds([]);
        }}
        onConfirm={() => handleDelete(pendingDeleteIds)}
        count={pendingDeleteIds.length}
        isSubmitting={isDeleting}
      />

      <UploadModal
        open={uploadModalOpen}
        onClose={() => {
          setUploadModalOpen(false);
          setUploadFile(null);
          setUploadError(null);
          setActionError(null);
          setActionMessage(null);
        }}
        onSubmit={handleUploadSubmit}
        file={uploadFile}
        onFileSelect={handleFileSelect}
        isSubmitting={isUploading}
        error={uploadError}
      />
    </section>
  );
};

interface BulkUpdateModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  values: { department: string; agency: string };
  setValues: Dispatch<SetStateAction<{ department: string; agency: string }>>;
  columnAccess: ManagementColumnAccess;
  options: ManagementOptions;
  disabled: boolean;
  isSubmitting: boolean;
}

const BulkUpdateModal = ({
  open,
  onClose,
  onSubmit,
  values,
  setValues,
  columnAccess,
  options,
  disabled,
  isSubmitting,
}: BulkUpdateModalProps) => {
  if (!open) {
    return null;
  }

  const shouldDisableSubmit = disabled || (!values.department.trim() && !values.agency.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">일괄 변경</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="모달 닫기"
          >
            ✕
          </button>
        </header>
        <form onSubmit={onSubmit} className="space-y-5 px-6 py-6">
          <p className="text-sm text-slate-600">
            선택한 행의 담당부서 또는 대행사를 새로운 값으로 일괄 변경합니다.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {columnAccess.department ? (
              <div className="space-y-2">
                <label
                  htmlFor="bulkDepartment"
                  className="block text-sm font-medium text-slate-700"
                >
                  담당부서
                </label>
                <input
                  id="bulkDepartment"
                  name="bulkDepartment"
                  type="text"
                  placeholder="변경할 담당부서"
                  value={values.department}
                  onChange={(event) => setValues({ ...values, department: event.target.value })}
                  disabled={isSubmitting}
                  list="bulk-department-options"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
                />
                <datalist id="bulk-department-options">
                  {options.departments.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </div>
            ) : null}

            {columnAccess.agency ? (
              <div className="space-y-2">
                <label htmlFor="bulkAgency" className="block text-sm font-medium text-slate-700">
                  대행사
                </label>
                <input
                  id="bulkAgency"
                  name="bulkAgency"
                  type="text"
                  placeholder="변경할 대행사"
                  value={values.agency}
                  onChange={(event) => setValues({ ...values, agency: event.target.value })}
                  disabled={isSubmitting}
                  list="bulk-agency-options"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
                />
                <datalist id="bulk-agency-options">
                  {options.agencies.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </div>
            ) : null}
          </div>

          <footer className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className={cn(
                "rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50",
                isSubmitting && "cursor-not-allowed opacity-70",
              )}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={shouldDisableSubmit || isSubmitting}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-semibold transition",
                shouldDisableSubmit || isSubmitting
                  ? "cursor-not-allowed bg-slate-200 text-slate-500"
                  : "bg-slate-900 text-white hover:bg-slate-800",
              )}
            >
              {isSubmitting ? "변경 중..." : "변경 적용"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

interface DeleteConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  count: number;
  isSubmitting: boolean;
}

const DeleteConfirmModal = ({
  open,
  onClose,
  onConfirm,
  count,
  isSubmitting,
}: DeleteConfirmModalProps) => {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">삭제 확인</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="모달 닫기"
          >
            ✕
          </button>
        </header>
        <div className="space-y-5 px-6 py-6 text-sm text-slate-600">
          <p>
            선택한 {count.toLocaleString("ko-KR")}건의 캠페인을 삭제하시겠습니까? 삭제된 데이터는
            복구할 수 없으며, 이 작업은 되돌릴 수 없습니다.
          </p>
        </div>
        <footer className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className={cn(
              "rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50",
              isSubmitting && "cursor-not-allowed opacity-70",
            )}
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-semibold transition",
              isSubmitting
                ? "cursor-not-allowed bg-slate-200 text-slate-500"
                : "bg-rose-600 text-white hover:bg-rose-500",
            )}
          >
            {isSubmitting ? "삭제 중..." : "삭제"}
          </button>
        </footer>
      </div>
    </div>
  );
};

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  file: File | null;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  isSubmitting: boolean;
  error: string | null;
}

const UploadModal = ({
  open,
  onClose,
  onSubmit,
  file,
  onFileSelect,
  isSubmitting,
  error,
}: UploadModalProps) => {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">엑셀 업로드</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="모달 닫기"
          >
            ✕
          </button>
        </header>
        <form onSubmit={onSubmit} className="space-y-5 px-6 py-6">
          <div className="space-y-2">
            <p className="text-sm text-slate-600">
              리포트에서 다운로드한 CSV 파일 또는 템플릿을 다운로드하여 작성한 CSV 파일을 업로드할
              수 있습니다.
            </p>
            <p className="text-xs text-slate-500">
              파일 형식: CSV (UTF-8), 최대 크기: 10MB
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="csv-file"
              className="block text-sm font-medium text-slate-700"
            >
              CSV 파일 선택
            </label>
            <input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={onFileSelect}
              disabled={isSubmitting}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
            {file && (
              <p className="text-xs text-slate-500">
                선택된 파일: {file.name} ({(file.size / 1024).toFixed(2)} KB)
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <p className="font-semibold">오류가 발생했습니다:</p>
              <p className="mt-1 whitespace-pre-wrap">{error}</p>
            </div>
          )}

          <footer className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className={cn(
                "rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50",
                isSubmitting && "cursor-not-allowed opacity-70",
              )}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!file || isSubmitting}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-semibold transition",
                !file || isSubmitting
                  ? "cursor-not-allowed bg-slate-200 text-slate-500"
                  : "bg-slate-900 text-white hover:bg-slate-800",
              )}
            >
              {isSubmitting ? "업로드 중..." : "업로드"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};
