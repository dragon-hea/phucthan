#Requires AutoHotkey v2
#NoTrayIcon
#SingleInstance Force

; =================================================================================
;  MODIFICATION: Added detailed logging and switched to English.
; =================================================================================
LogFile := A_ScriptDir . "\click_log.txt"
; FIX: Wrap file deletion in a try block to avoid errors if the file doesn't exist.
try FileDelete(LogFile)

; Log function - appends a timestamped message to the log file.
Log(text) => FileAppend(FormatTime(, "HH:mm:ss") . " - " . text . "`n", LogFile)

Log("--- Starting click.ahk script ---")

if A_Args.Length < 2 {
    Log("Error: Not enough parameters (x, y). Exiting.")
    ExitApp
}

x := Integer(A_Args[1])
y := Integer(A_Args[2])
Log("Parameters received: x=" . x . ", y=" . y)

; --- Find Target Window and Control ---
hChrome := 0
hwnd := 0
Log("Searching for browser window...")

try {
    hChrome := WinGetID("ahk_exe chrome.exe")
    if hChrome {
        Log("Found Chrome.exe, hChrome=" . hChrome)
    } else {
        hChrome := WinGetID("ahk_exe msedge.exe")
        if hChrome {
            Log("Found msedge.exe, hChrome=" . hChrome)
        } else {
            hChrome := WinGetID("ahk_class Chrome_WidgetWin_1")
            if hChrome {
                Log("Found by class Chrome_WidgetWin_1, hChrome=" . hChrome)
            }
        }
    }
} catch as e {
    Log("Error finding window: " . e.Message)
}

if !hChrome {
    Log("No browser window found. Exiting.")
    ExitApp
}
Log("Found main browser window, hChrome=" . hChrome)

; Find the main render widget (viewport) inside the window.
Log("Searching for RenderWidget...")
try {
    maxArea := 0
    foundRenderWidget := false
    for id in WinGetControlsHwnd(hChrome) {
        try {
            className := WinGetClass("ahk_id " . id)
            if (className == "Chrome_RenderWidgetHostHWND") {
                foundRenderWidget := true
                WinGetPos(,, &w, &h, "ahk_id " . id)
                area := w * h
                Log("Found RenderWidget, id=" . id . ", area=" . area)
                if (area > maxArea) {
                    hwnd := id
                    maxArea := area
                    Log("=> Selecting this RenderWidget (largest area).")
                }
            }
        } catch as e {
            Log("Error processing control ID " . id . ": " . e.Message)
            continue
        }
    }
    if !foundRenderWidget {
        Log("No control with class 'Chrome_RenderWidgetHostHWND' found.")
    }
} catch as e {
    Log("Error in RenderWidget search loop: " . e.Message)
}

if !hwnd {
    Log("No suitable RenderWidget found. Using main window as fallback, hwnd=" . hChrome)
    hwnd := hChrome
}

if !hwnd {
    Log("No handle (hwnd) to click. Exiting.")
    ExitApp
}
Log("Final handle (hwnd) selected for click: " . hwnd)

; --- Perform Background Click ---
Log("Starting click action...")
try {
    Log("Attempting ControlClick method...")
    ControlClick(, "ahk_id " . hwnd, , "Left", 1, "x" . x . " y" . y . " NA")
    Log("ControlClick called on hwnd=" . hwnd . " at coordinates x=" . x . ", y=" . y)
} catch as e {
    Log("Error during ControlClick: " . e.Message)
    Log("Attempting PostMessage method...")
    try {
        PostMessage(0x201, 0x0001, (y << 16) | x, , "ahk_id " . hwnd) ; WM_LBUTTONDOWN
        Sleep(30)
        PostMessage(0x202, 0, (y << 16) | x, , "ahk_id " . hwnd)       ; WM_LBUTTONUP
        Log("PostMessage sent to hwnd=" . hwnd . " at coordinates x=" . x . ", y=" . y)
    } catch as e2 {
        Log("Error during PostMessage: " . e2.Message)
    }
}

Log("--- Finished click.ahk script ---")
ExitApp