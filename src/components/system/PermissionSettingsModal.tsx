"use client";

import { FormEvent, useState, useEffect } from "react";

import { cn } from "@/lib/utils";
import type { SystemUser, PermissionFormData } from "@/types/system";
import type { MasterDataItem } from "@/types/master-data";
import { COLUMN_KEYS } from "@/types/auth";

interface PermissionSettingsModalProps {
  open: boolean;
  onClose: () => void;
  user: SystemUser;
  departments: MasterDataItem[];
  agencies: MasterDataItem[];
  onSubmit: (data: PermissionFormData) => void;
  isSubmitting: boolean;
}

const COLUMN_LABELS: Record<string, string> = {
  campaign: "캠페인",
  creative: "소재",
  channel: "매체/구분",
  schedule: "일정(기간)",
  spend: "광고비",
  budgetAccount: "예산계정",
  department: "담당부서",
  agency: "대행사",
};

export const PermissionSettingsModal = ({
  open,
  onClose,
  user,
  departments,
  agencies,
  onSubmit,
  isSubmitting,
}: PermissionSettingsModalProps) => {
  const [columnPermissions, setColumnPermissions] = useState<
    Record<string, boolean>
  >(user.accessProfile?.columnPermissions ?? {});
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>(
    user.accessProfile?.departments ?? [],
  );
  const [selectedAgencies, setSelectedAgencies] = useState<string[]>(
    user.accessProfile?.agencies ?? [],
  );

  // user가 변경될 때마다 상태 업데이트
  useEffect(() => {
    setColumnPermissions(user.accessProfile?.columnPermissions ?? {});
    setSelectedDepartments(user.accessProfile?.departments ?? []);
    setSelectedAgencies(user.accessProfile?.agencies ?? []);
  }, [user]);

  if (!open) {
    return null;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // 모든 컬럼 키에 대한 권한을 포함하도록 보장
    const fullColumnPermissions: Record<string, boolean> = {};
    COLUMN_KEYS.forEach((key) => {
      fullColumnPermissions[key] = columnPermissions[key] ?? false;
    });

    onSubmit({
      columnPermissions: fullColumnPermissions as PermissionFormData["columnPermissions"],
      scope: {
        departments: selectedDepartments,
        agencies: selectedAgencies,
      },
    });
  };

  const toggleColumnPermission = (columnKey: string) => {
    setColumnPermissions((prev) => ({
      ...prev,
      [columnKey]: !prev[columnKey],
    }));
  };

  const toggleDepartment = (department: string) => {
    setSelectedDepartments((prev) => {
      if (prev.includes(department)) {
        return prev.filter((d) => d !== department);
      }
      return [...prev, department];
    });
  };

  const toggleAgency = (agency: string) => {
    setSelectedAgencies((prev) => {
      if (prev.includes(agency)) {
        return prev.filter((a) => a !== agency);
      }
      return [...prev, agency];
    });
  };

  // 전체선택/전체취소 함수들
  const selectAllDepartments = () => {
    setSelectedDepartments(departments.map((dept) => dept.value));
  };

  const deselectAllDepartments = () => {
    setSelectedDepartments([]);
  };

  const selectAllAgencies = () => {
    setSelectedAgencies(agencies.map((agency) => agency.value));
  };

  const deselectAllAgencies = () => {
    setSelectedAgencies([]);
  };

  const selectAllColumns = () => {
    const allSelected: Record<string, boolean> = {};
    COLUMN_KEYS.forEach((key) => {
      allSelected[key] = true;
    });
    setColumnPermissions(allSelected);
  };

  const deselectAllColumns = () => {
    const allDeselected: Record<string, boolean> = {};
    COLUMN_KEYS.forEach((key) => {
      allDeselected[key] = false;
    });
    setColumnPermissions(allDeselected);
  };

  // 전체 선택 여부 확인
  const areAllDepartmentsSelected = departments.length > 0 && selectedDepartments.length === departments.length;
  const areAllAgenciesSelected = agencies.length > 0 && selectedAgencies.length === agencies.length;
  const areAllColumnsSelected = COLUMN_KEYS.every((key) => columnPermissions[key] === true);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <header className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">권한 설정</h2>
            <p className="mt-1 text-sm text-slate-600">사용자: {user.loginId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="모달 닫기"
          >
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6 px-6 py-6">
          {/* 데이터 스코프 할당 */}
          <section className="space-y-4">
            <h3 className="text-base font-semibold text-slate-900">데이터 스코프 할당</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-slate-700">
                    담당부서
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAllDepartments}
                      disabled={isSubmitting || departments.length === 0 || areAllDepartmentsSelected}
                      className={cn(
                        "rounded px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100",
                        (isSubmitting || departments.length === 0 || areAllDepartmentsSelected) &&
                          "cursor-not-allowed opacity-50",
                      )}
                    >
                      전체선택
                    </button>
                    <button
                      type="button"
                      onClick={deselectAllDepartments}
                      disabled={isSubmitting || selectedDepartments.length === 0}
                      className={cn(
                        "rounded px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100",
                        (isSubmitting || selectedDepartments.length === 0) && "cursor-not-allowed opacity-50",
                      )}
                    >
                      전체취소
                    </button>
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 p-3 space-y-2">
                  {departments.length === 0 ? (
                    <p className="text-xs text-slate-500">등록된 담당부서가 없습니다.</p>
                  ) : (
                    departments.map((dept) => (
                      <label
                        key={dept.id}
                        className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={selectedDepartments.includes(dept.value)}
                          onChange={() => toggleDepartment(dept.value)}
                          disabled={isSubmitting}
                          className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                        />
                        <span className="text-sm text-slate-700">{dept.value}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-slate-700">
                    대행사
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAllAgencies}
                      disabled={isSubmitting || agencies.length === 0 || areAllAgenciesSelected}
                      className={cn(
                        "rounded px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100",
                        (isSubmitting || agencies.length === 0 || areAllAgenciesSelected) &&
                          "cursor-not-allowed opacity-50",
                      )}
                    >
                      전체선택
                    </button>
                    <button
                      type="button"
                      onClick={deselectAllAgencies}
                      disabled={isSubmitting || selectedAgencies.length === 0}
                      className={cn(
                        "rounded px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100",
                        (isSubmitting || selectedAgencies.length === 0) && "cursor-not-allowed opacity-50",
                      )}
                    >
                      전체취소
                    </button>
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 p-3 space-y-2">
                  {agencies.length === 0 ? (
                    <p className="text-xs text-slate-500">등록된 대행사가 없습니다.</p>
                  ) : (
                    agencies.map((agency) => (
                      <label
                        key={agency.id}
                        className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={selectedAgencies.includes(agency.value)}
                          onChange={() => toggleAgency(agency.value)}
                          disabled={isSubmitting}
                          className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                        />
                        <span className="text-sm text-slate-700">{agency.value}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* 컬럼 접근 권한 */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">컬럼 접근 권한</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAllColumns}
                  disabled={isSubmitting || areAllColumnsSelected}
                  className={cn(
                    "rounded px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100",
                    (isSubmitting || areAllColumnsSelected) && "cursor-not-allowed opacity-50",
                  )}
                >
                  전체선택
                </button>
                <button
                  type="button"
                  onClick={deselectAllColumns}
                  disabled={isSubmitting || COLUMN_KEYS.every((key) => !columnPermissions[key])}
                  className={cn(
                    "rounded px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100",
                    (isSubmitting || COLUMN_KEYS.every((key) => !columnPermissions[key])) &&
                      "cursor-not-allowed opacity-50",
                  )}
                >
                  전체취소
                </button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {COLUMN_KEYS.map((columnKey) => (
                <label
                  key={columnKey}
                  className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-3 rounded-lg border border-slate-200"
                >
                  <input
                    type="checkbox"
                    checked={columnPermissions[columnKey] ?? false}
                    onChange={() => toggleColumnPermission(columnKey)}
                    disabled={isSubmitting}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                  />
                  <span className="text-sm text-slate-700">
                    {COLUMN_LABELS[columnKey] ?? columnKey}
                  </span>
                </label>
              ))}
            </div>
          </section>

          <footer className="flex justify-end gap-3 border-t border-slate-100 pt-4">
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
              disabled={isSubmitting}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-semibold transition",
                isSubmitting
                  ? "cursor-not-allowed bg-slate-200 text-slate-500"
                  : "bg-slate-900 text-white hover:bg-slate-800",
              )}
            >
              {isSubmitting ? "저장 중..." : "저장"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

