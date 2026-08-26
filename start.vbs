Set shell = CreateObject("WScript.Shell")
base = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
shell.CurrentDirectory = base
shell.Run "pythonw.exe tray.py", 0, False
