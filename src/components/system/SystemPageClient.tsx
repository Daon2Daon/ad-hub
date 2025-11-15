"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";

import {
  approveUserAction,
  changePasswordAction,
  deleteUserAction,
  resetPasswordAction,
  updatePermissionsAction,
} from "@/lib/system/actions";
import { cn } from "@/lib/utils";
import type { SystemUser, PermissionFormData } from "@/types/system";
import type { MasterDataItem } from "@/types/master-data";
import { PermissionSettingsModal } from "./PermissionSettingsModal";
import { ResetPasswordModal } from "./ResetPasswordModal";

interface SystemPageClientProps {
  pendingUsers: SystemUser[];
  activeUsers: SystemUser[];
  departments: MasterDataItem[];
  agencies: MasterDataItem[];
}

type Tab = "password" | "users";

export const SystemPageClient = ({
  pendingUsers: initialPendingUsers,
  activeUsers: initialActiveUsers,
  departments,
  agencies,
}: SystemPageClientProps) => {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>("password");
  const [pendingUsers, setPendingUsers] = useState<SystemUser[]>(initialPendingUsers);
  const [activeUsers, setActiveUsers] = useState<SystemUser[]>(initialActiveUsers);

  // 비밀번호 변경 상태
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // 권한 설정 모달 상태
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);

  // 비밀번호 재설정 모달 상태
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");

  // 사용자 삭제 확인 상태
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetUser, setDeleteTargetUser] = useState<SystemUser | null>(null);

  const { execute: changePassword, isExecuting: isChangingPassword } = useAction(
    changePasswordAction,
    {
      onSuccess: () => {
        setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
        setPasswordError(null);
        setPasswordSuccess(true);
        setTimeout(() => setPasswordSuccess(false), 3000);
      },
      onError: ({ error }) => {
        const message =
          typeof error.serverError === "string"
            ? error.serverError
            : "비밀번호 변경에 실패했습니다.";
        setPasswordError(message);
      },
    },
  );

  const { execute: approveUser, isExecuting: isApproving } = useAction(approveUserAction, {
    onSuccess: ({ data }) => {
      if (!data) {
        return;
      }

      // pending 목록에서 제거
      setPendingUsers((prev) => prev.filter((user) => user.id !== data.userId));

      // 승인된 경우 active 목록에 추가
      if (data.status === "active" && "user" in data && data.user) {
        const approvedUser = data.user;
        setActiveUsers((prev) => {
          // 이미 존재하는지 확인 (중복 방지)
          const exists = prev.some((user) => user.id === approvedUser.id);
          if (exists) {
            return prev;
          }
          // 최신순으로 정렬하여 맨 위에 추가
          return [approvedUser, ...prev];
        });
      }
    },
    onError: ({ error }) => {
      const message =
        typeof error.serverError === "string" ? error.serverError : "처리에 실패했습니다.";
      alert(message);
    },
  });

  const { execute: resetPassword, isExecuting: isResettingPassword } = useAction(
    resetPasswordAction,
    {
      onSuccess: () => {
        setResetPasswordModalOpen(false);
        setResetPasswordUserId(null);
        setResetPasswordValue("");
        router.refresh();
      },
      onError: ({ error }) => {
        const message =
          typeof error.serverError === "string" ? error.serverError : "비밀번호 재설정에 실패했습니다.";
        alert(message);
      },
    },
  );

  const { execute: updatePermissions, isExecuting: isUpdatingPermissions } = useAction(
    updatePermissionsAction,
    {
      onSuccess: () => {
        setPermissionModalOpen(false);
        setSelectedUser(null);
        router.refresh();
      },
      onError: ({ error }) => {
        const message =
          typeof error.serverError === "string" ? error.serverError : "권한 설정에 실패했습니다.";
        alert(message);
      },
    },
  );

  const { execute: deleteUser, isExecuting: isDeletingUser } = useAction(deleteUserAction, {
    onSuccess: ({ data }) => {
      if (!data) {
        return;
      }

      // active 목록에서 제거
      setActiveUsers((prev) => prev.filter((user) => user.id !== data.userId));
      // pending 목록에서도 제거 (혹시 모를 경우 대비)
      setPendingUsers((prev) => prev.filter((user) => user.id !== data.userId));

      setDeleteConfirmOpen(false);
      setDeleteTargetUser(null);
    },
    onError: ({ error }) => {
      const message =
        typeof error.serverError === "string" ? error.serverError : "사용자 삭제에 실패했습니다.";
      alert(message);
    },
  });

  const handlePasswordSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError(null);
    changePassword(passwordForm);
  };

  const handleApprove = (userId: string, action: "approve" | "reject") => {
    approveUser({ userId, action });
  };

  const handleOpenPermissionModal = (user: SystemUser) => {
    setSelectedUser(user);
    setPermissionModalOpen(true);
  };

  const handleOpenResetPasswordModal = (userId: string) => {
    setResetPasswordUserId(userId);
    setResetPasswordModalOpen(true);
  };

  const handleOpenDeleteConfirm = (user: SystemUser) => {
    setDeleteTargetUser(user);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!deleteTargetUser) {
      return;
    }

    deleteUser({ userId: deleteTargetUser.id });
  };

  const handlePermissionSubmit = (data: PermissionFormData) => {
    if (!selectedUser) {
      return;
    }

    updatePermissions({
      userId: selectedUser.id,
      columnPermissions: data.columnPermissions,
      scope: data.scope,
    });
  };

  const handleResetPasswordSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resetPasswordUserId) {
      return;
    }

    resetPassword({
      userId: resetPasswordUserId,
      newPassword: resetPasswordValue,
    });
  };

  return (
    <section className="flex flex-col gap-6">
      <header className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">시스템 관리</h1>
        <p className="mt-2 text-sm text-slate-600">
          비밀번호 변경 및 사용자 관리 기능을 제공합니다.
        </p>
      </header>

      {/* 탭 네비게이션 */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("password")}
          className={cn(
            "rounded-t-lg px-6 py-3 text-sm font-semibold transition",
            activeTab === "password"
              ? "border-b-2 border-slate-900 bg-white text-slate-900"
              : "text-slate-600 hover:text-slate-900",
          )}
        >
          비밀번호 변경
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("users")}
          className={cn(
            "rounded-t-lg px-6 py-3 text-sm font-semibold transition",
            activeTab === "users"
              ? "border-b-2 border-slate-900 bg-white text-slate-900"
              : "text-slate-600 hover:text-slate-900",
          )}
        >
          사용자 관리
        </button>
      </div>

      {/* 비밀번호 변경 탭 */}
      {activeTab === "password" && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">비밀번호 변경</h2>
          <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
            <div className="space-y-2">
              <label htmlFor="currentPassword" className="block text-sm font-medium text-slate-700">
                현재 비밀번호
              </label>
              <input
                id="currentPassword"
                type="password"
                value={passwordForm.currentPassword}
                onChange={(event) =>
                  setPasswordForm({ ...passwordForm, currentPassword: event.target.value })
                }
                disabled={isChangingPassword}
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700">
                새 비밀번호
              </label>
              <input
                id="newPassword"
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) =>
                  setPasswordForm({ ...passwordForm, newPassword: event.target.value })
                }
                disabled={isChangingPassword}
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
              <p className="text-xs text-slate-500">
                8자 이상, 영문과 숫자를 포함해야 합니다.
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-slate-700"
              >
                새 비밀번호 확인
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(event) =>
                  setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })
                }
                disabled={isChangingPassword}
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </div>

            {passwordError && (
              <div className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div className="rounded-lg border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">
                비밀번호가 성공적으로 변경되었습니다.
              </div>
            )}

            <button
              type="submit"
              disabled={isChangingPassword}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-semibold transition",
                isChangingPassword
                  ? "cursor-not-allowed bg-slate-200 text-slate-500"
                  : "bg-slate-900 text-white hover:bg-slate-800",
              )}
            >
              {isChangingPassword ? "변경 중..." : "비밀번호 변경"}
            </button>
          </form>
        </section>
      )}

      {/* 사용자 관리 탭 */}
      {activeTab === "users" && (
        <section className="space-y-6">
          {/* 가입 승인 목록 */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">가입 승인 목록</h2>
            {pendingUsers.length === 0 ? (
              <p className="text-sm text-slate-500">승인 대기 중인 사용자가 없습니다.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        아이디
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        이름
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        이메일
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        가입일
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        액션
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pendingUsers.map((user) => (
                      <tr key={user.id}>
                        <td className="px-4 py-3 text-sm text-slate-700">{user.loginId}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{user.name ?? "-"}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{user.email ?? "-"}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {new Date(user.createdAt).toLocaleDateString("ko-KR")}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleApprove(user.id, "approve")}
                              disabled={isApproving}
                              className={cn(
                                "rounded-lg border border-green-200 px-3 py-1 text-xs font-semibold text-green-600 transition hover:border-green-300 hover:bg-green-50",
                                isApproving && "cursor-not-allowed opacity-70",
                              )}
                            >
                              승인
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApprove(user.id, "reject")}
                              disabled={isApproving}
                              className={cn(
                                "rounded-lg border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-50",
                                isApproving && "cursor-not-allowed opacity-70",
                              )}
                            >
                              거절
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 전체 사용자 목록 */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">전체 사용자 목록</h2>
            {activeUsers.length === 0 ? (
              <p className="text-sm text-slate-500">등록된 사용자가 없습니다.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        아이디
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        이름
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        역할
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        상태
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        액션
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeUsers.map((user) => (
                      <tr key={user.id}>
                        <td className="px-4 py-3 text-sm text-slate-700">{user.loginId}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{user.name ?? "-"}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {user.role === "admin" ? "관리자" : "일반 사용자"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {user.status === "active" ? "활성" : "정지"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenPermissionModal(user)}
                              className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                            >
                              권한 설정
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenResetPasswordModal(user.id)}
                              className="rounded-lg border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-600 transition hover:border-amber-300 hover:bg-amber-50"
                            >
                              비밀번호 재설정
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDeleteConfirm(user)}
                              disabled={isDeletingUser}
                              className={cn(
                                "rounded-lg border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-50",
                                isDeletingUser && "cursor-not-allowed opacity-70",
                              )}
                            >
                              삭제
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 권한 설정 모달 */}
      {selectedUser && (
        <PermissionSettingsModal
          open={permissionModalOpen}
          onClose={() => {
            setPermissionModalOpen(false);
            setSelectedUser(null);
          }}
          user={selectedUser}
          departments={departments}
          agencies={agencies}
          onSubmit={handlePermissionSubmit}
          isSubmitting={isUpdatingPermissions}
        />
      )}

      {/* 비밀번호 재설정 모달 */}
      <ResetPasswordModal
        open={resetPasswordModalOpen}
        onClose={() => {
          setResetPasswordModalOpen(false);
          setResetPasswordUserId(null);
          setResetPasswordValue("");
        }}
        onSubmit={handleResetPasswordSubmit}
        password={resetPasswordValue}
        setPassword={setResetPasswordValue}
        isSubmitting={isResettingPassword}
      />

      {/* 사용자 삭제 확인 모달 */}
      {deleteConfirmOpen && deleteTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">사용자 삭제 확인</h3>
            <p className="mb-2 text-sm text-slate-600">
              다음 사용자를 삭제하시겠습니까?
            </p>
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-900">
                아이디: <span className="font-semibold">{deleteTargetUser.loginId}</span>
              </p>
              {deleteTargetUser.name && (
                <p className="mt-1 text-sm text-slate-700">
                  이름: <span className="font-medium">{deleteTargetUser.name}</span>
                </p>
              )}
            </div>
            <p className="mb-4 text-xs text-rose-600">
              ⚠️ 이 작업은 되돌릴 수 없습니다. 사용자와 관련된 모든 데이터가 삭제됩니다.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setDeleteTargetUser(null);
                }}
                disabled={isDeletingUser}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeletingUser}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-medium text-white transition",
                  isDeletingUser
                    ? "cursor-not-allowed bg-rose-400"
                    : "bg-rose-600 hover:bg-rose-700",
                )}
              >
                {isDeletingUser ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

