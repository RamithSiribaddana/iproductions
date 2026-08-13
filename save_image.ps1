[System.Reflection.Assembly]::LoadWithPartialName('System.Drawing') | Out-Null
[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms') | Out-Null

if ([System.Windows.Forms.Clipboard]::ContainsImage()) {
    $img = [System.Windows.Forms.Clipboard]::GetImage()
    $img.Save('c:\Users\Computer Agent\Desktop\files (1)\images\owner.jpg')
    Write-Host 'Image saved successfully'
} else {
    Write-Host 'No image in clipboard'
}
