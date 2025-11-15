/**
 * 전역 로딩 UI 컴포넌트
 * 페이지 로딩 중 자동으로 표시됩니다.
 */
const Loading = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900"></div>
        </div>
        <p className="text-sm text-slate-600">로딩 중...</p>
      </div>
    </div>
  );
};

export default Loading;

