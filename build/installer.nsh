!macro customInit
  ${IfNot} ${isUpdated}
    StrCpy $INSTDIR "$LOCALAPPDATA\Programs\pxpet"
  ${EndIf}
!macroend
