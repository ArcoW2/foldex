// A lister plugin for testing Foldex's plugin helper (docs/plans/executed/33-PLAN-preview-plugins.md 3.5): it takes files with
// the extension .fxt and shows their name and first bytes in a read-only edit box. A file whose name holds "crash"
// crashes it, one whose name holds "hang" hangs it. Build (a Visual Studio x64 prompt):
//   cl /nologo /LD /O2 testlister.c user32.lib /Fe:testlister.wlx64
#include <windows.h>
#include <wchar.h>

static void Fill(HWND edit, const WCHAR* file)
{
    WCHAR text[4096];
    char bytes[1024] = { 0 };
    DWORD read = 0;
    HANDLE h = CreateFileW(file, GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, NULL, OPEN_EXISTING, 0, NULL);
    if (h != INVALID_HANDLE_VALUE) { ReadFile(h, bytes, sizeof bytes - 1, &read, NULL); CloseHandle(h); }
    swprintf(text, 4096, L"Test lister\r\n%s\r\n\r\n%hs", file, bytes);
    SetWindowTextW(edit, text);
}

__declspec(dllexport) void __stdcall ListGetDetectString(char* detect, int max)
{
    lstrcpynA(detect, "EXT=\"FXT\"", max);
}

__declspec(dllexport) HWND __stdcall ListLoadW(HWND parent, WCHAR* file, int flags)
{
    RECT r;
    HWND edit;
    if (wcsstr(file, L"crash")) *(volatile int*)0 = 0;
    if (wcsstr(file, L"hang")) Sleep(INFINITE);
    GetClientRect(parent, &r);
    edit = CreateWindowExW(0, L"EDIT", L"", WS_CHILD | WS_VISIBLE | WS_VSCROLL | ES_MULTILINE | ES_READONLY,
        0, 0, r.right, r.bottom, parent, NULL, NULL, NULL);
    if (edit) Fill(edit, file);
    return edit;
}

__declspec(dllexport) int __stdcall ListLoadNextW(HWND parent, HWND list, WCHAR* file, int flags)
{
    if (wcsstr(file, L"crash")) *(volatile int*)0 = 0;
    Fill(list, file);
    return 0;
}

__declspec(dllexport) void __stdcall ListCloseWindow(HWND list)
{
    DestroyWindow(list);
}
