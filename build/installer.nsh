; Meridian Connect installer additions (2026-10-06, updated 2026-10-08 for auto-update)
; First install: removes any old desktop icon, then ASKS whether to create a new one.
; Auto-updates run silently and keep the person's desktop icon as it is.
!macro customInstall
  ${ifNot} ${isUpdated}
    Delete "$DESKTOP\Meridian Connect.lnk"
    MessageBox MB_YESNO|MB_ICONQUESTION "Create a Meridian Connect icon on your desktop?" /SD IDYES IDNO skipDesktop
      CreateShortCut "$DESKTOP\Meridian Connect.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\resources\meridian.ico" 0
    skipDesktop:
  ${endIf}
!macroend

!macro customUnInstall
  ${ifNot} ${isUpdated}
    Delete "$DESKTOP\Meridian Connect.lnk"
  ${endIf}
!macroend
