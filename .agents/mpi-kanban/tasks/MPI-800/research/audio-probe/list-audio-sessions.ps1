# List every Windows audio render session: device, owning process, state, peak level.
# Core Audio COM through Add-Type — no modules to install.
$src = @'
using System;
using System.Runtime.InteropServices;

public static class CoreAudio {
    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] public class MMDeviceEnumerator { }

    [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IMMDeviceEnumerator {
        int EnumAudioEndpoints(int dataFlow, int stateMask, out IMMDeviceCollection devices);
        int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice device);
    }
    [ComImport, Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IMMDeviceCollection { int GetCount(out int count); int Item(int index, out IMMDevice device); }

    [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IMMDevice {
        int Activate(ref Guid iid, int clsCtx, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object iface);
        int OpenPropertyStore(int access, out IPropertyStore store);
        int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
        int GetState(out int state);
    }
    [ComImport, Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IPropertyStore {
        int GetCount(out int count);
        int GetAt(int index, out PROPERTYKEY key);
        int GetValue(ref PROPERTYKEY key, out PROPVARIANT value);
    }
    [StructLayout(LayoutKind.Sequential)] public struct PROPERTYKEY { public Guid fmtid; public int pid; }
    [StructLayout(LayoutKind.Explicit)] public struct PROPVARIANT {
        [FieldOffset(0)] public short vt; [FieldOffset(8)] public IntPtr pointerValue;
    }

    [ComImport, Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IAudioSessionManager2 {
        int NotImpl1(); int NotImpl2();
        int GetSessionEnumerator(out IAudioSessionEnumerator sessionEnum);
    }
    [ComImport, Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IAudioSessionEnumerator { int GetCount(out int count); int GetSession(int index, out IAudioSessionControl session); }
    [ComImport, Guid("F4B1A599-7266-4319-A8CA-E70ACB11E8CD"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IAudioSessionControl { int GetState(out int state); }
    [ComImport, Guid("bfb7ff88-7239-4fc9-8fa2-07c950be9c6d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IAudioSessionControl2 {
        int GetState(out int state);
        int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string name);
        int SetDisplayName([MarshalAs(UnmanagedType.LPWStr)] string value, ref Guid ctx);
        int GetIconPath([MarshalAs(UnmanagedType.LPWStr)] out string path);
        int SetIconPath([MarshalAs(UnmanagedType.LPWStr)] string value, ref Guid ctx);
        int GetGroupingParam(out Guid group);
        int SetGroupingParam(ref Guid group, ref Guid ctx);
        int RegisterAudioSessionNotification(IntPtr n);
        int UnregisterAudioSessionNotification(IntPtr n);
        int GetSessionIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string id);
        int GetSessionInstanceIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string id);
        int GetProcessId(out int pid);
        int IsSystemSoundsSession();
        int SetDuckingPreference(bool opt);
    }
    [ComImport, Guid("C02216F6-8C67-4B5B-9D00-D008E73E0064"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IAudioMeterInformation { int GetPeakValue(out float peak); }

    static Guid IID_SessionManager2 = new Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F");
    static Guid IID_Meter = new Guid("C02216F6-8C67-4B5B-9D00-D008E73E0064");
    static PROPERTYKEY PKEY_Device_FriendlyName = new PROPERTYKEY {
        fmtid = new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"), pid = 14 };

    public static void Dump() {
        var en = (IMMDeviceEnumerator)(new MMDeviceEnumerator());
        IMMDeviceCollection devs; en.EnumAudioEndpoints(0 /*render*/, 1 /*ACTIVE*/, out devs);
        int n; devs.GetCount(out n);
        for (int i = 0; i < n; i++) {
            IMMDevice dev; devs.Item(i, out dev);
            IPropertyStore store; dev.OpenPropertyStore(0, out store);
            PROPVARIANT pv; store.GetValue(ref PKEY_Device_FriendlyName, out pv);
            string devName = Marshal.PtrToStringUni(pv.pointerValue);
            object o; dev.Activate(ref IID_SessionManager2, 1, IntPtr.Zero, out o);
            var mgr = (IAudioSessionManager2)o;
            IAudioSessionEnumerator se; mgr.GetSessionEnumerator(out se);
            int sc; se.GetCount(out sc);
            Console.WriteLine("DEVICE: " + devName + "  sessions=" + sc);
            for (int j = 0; j < sc; j++) {
                IAudioSessionControl ctl; se.GetSession(j, out ctl);
                var c2 = (IAudioSessionControl2)ctl;
                int pid; c2.GetProcessId(out pid);
                int state; c2.GetState(out state);
                float peak = -1;
                try { var meter = (IAudioMeterInformation)ctl; meter.GetPeakValue(out peak); } catch {}
                string pname = "?";
                try { pname = System.Diagnostics.Process.GetProcessById(pid).ProcessName; } catch {}
                string disp = ""; try { c2.GetDisplayName(out disp); } catch {}
                Console.WriteLine("   pid=" + pid + " " + pname + " state=" + state + " peak=" + peak.ToString("0.0000") + " " + disp);
            }
        }
    }
}
'@
Add-Type -TypeDefinition $src -Language CSharp
[CoreAudio]::Dump()
