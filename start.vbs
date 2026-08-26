' Word Reader 无窗口启动器
' 双击本文件：后台静默启动服务，不显示黑窗口。
' 任务栏右下角出现 Word Reader 图标，右键可打开网页/查看IP/停止服务。
Set fso   = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

base = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = base

' pythonw.exe 无控制台；用 0 隐藏窗口启动
shell.Run "pythonw.exe tray.py", 0, False
