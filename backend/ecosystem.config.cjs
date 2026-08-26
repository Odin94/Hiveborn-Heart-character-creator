module.exports = {
    apps: [
        {
            name: "hiveborn-backend",
            script: "npm",
            args: "start",
            cwd: "/opt/hiveborn/backend",
            instances: 1,
            exec_mode: "fork",
            env: {
                NODE_ENV: "production",
                PORT: 3003,
                HOST: "localhost",
            },
            error_file: "/var/log/hiveborn-backend/error.log",
            out_file: "/var/log/hiveborn-backend/out.log",
            log_file: "/var/log/hiveborn-backend/combined.log",
            time: true,
            autorestart: true,
            max_restarts: 10,
            min_uptime: "10s",
            max_memory_restart: "2G",
        },
    ],
}
