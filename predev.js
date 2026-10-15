const { execSync } = require("child_process");

function freePort(port) {
  try {
    const stdout = execSync("netstat -ano", { encoding: "utf-8" });
    const lines = stdout.split("\n");
    const pids = new Set();
    for (const line of lines) {
      if (line.includes(":" + port) && line.includes("LISTENING")) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== "0" && pid !== String(process.pid)) {
          pids.add(pid);
        }
      }
    }

    for (const pid of pids) {
      console.log(`[WallAura] Freeing occupied port ${port} (PID ${pid})...`);
      try {
        execSync(`powershell -NoProfile -Command "Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue"`, { stdio: "ignore" });
      } catch (e) {}
      try {
        execSync(`taskkill /F /T /PID ${pid}`, { stdio: "ignore" });
      } catch (e) {}
    }
  } catch (e) {}
}

function freeOrphanProcesses() {
  try {
    // Terminate any rogue Python or Node processes from previous runs
    execSync(
      'powershell -NoProfile -Command "Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { ($_.Name -match \'python\' -and ($_.CommandLine -match \'app.py\' -or $_.CommandLine -match \'multiprocessing\' -or $_.CommandLine -match \'uvicorn\')) -or ($_.Name -match \'node\' -and ($_.CommandLine -match \'next\' -or $_.CommandLine -match \'run_backend\')) } | Where-Object { $_.ProcessId -ne ' + process.pid + ' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"',
      { stdio: "ignore" }
    );
  } catch (e) {}
}

// Clean up ports 3000 and 8000 and any orphan processes
freePort(3000);
freePort(8000);
freeOrphanProcesses();
