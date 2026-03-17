use std::process::Command;
use std::path::Path;

fn find_ytdlp() -> String {
    let local = if cfg!(windows) { "bin\\yt-dlp.exe" } else { "bin/yt-dlp" };
    if std::path::Path::new(local).exists() {
        local.to_string()
    } else {
        "yt-dlp".to_string()
    }
}

#[tauri::command]
fn ytdlp_search(query: String) -> Result<String, String> {
    let ytdlp = find_ytdlp();
    let output = Command::new(&ytdlp)
        .args([
            &format!("ytsearch10:{}", query),
            "--flat-playlist",
            "-j",
            "--no-warnings",
        ])
        .output()
        .map_err(|e| format!("Failed to run yt-dlp: {}", e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        Ok(stdout)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("yt-dlp error: {}", stderr))
    }
}

#[tauri::command]
fn ytdlp_stream(video_id: String) -> Result<String, String> {
    // Validate video ID to prevent command injection
    if !video_id.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
        return Err("Invalid video ID".to_string());
    }

    let ytdlp = find_ytdlp();
    let output = Command::new(&ytdlp)
        .args([
            "-f", "bestaudio",
            "-j",
            "--no-warnings",
            &format!("https://www.youtube.com/watch?v={}", video_id),
        ])
        .output()
        .map_err(|e| format!("Failed to run yt-dlp: {}", e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        Ok(stdout)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("yt-dlp error: {}", stderr))
    }
}

#[derive(serde::Serialize)]
struct AudioFile {
    path: String,
    filename: String,
    folder: String,
}

#[tauri::command]
fn scan_music_dir(dir: String) -> Result<Vec<AudioFile>, String> {
    let base = Path::new(&dir);
    if !base.is_dir() {
        return Err("Not a directory".to_string());
    }

    let audio_exts = ["mp3", "wav", "ogg", "flac", "m4a", "aac", "wma", "opus"];
    let mut files = Vec::new();

    fn walk(dir: &Path, base: &Path, exts: &[&str], out: &mut Vec<AudioFile>) {
        let entries = match std::fs::read_dir(dir) {
            Ok(e) => e,
            Err(_) => return,
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                walk(&path, base, exts, out);
            } else if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                if exts.iter().any(|&a| a.eq_ignore_ascii_case(ext)) {
                    let filename = path.file_name()
                        .unwrap_or_default().to_string_lossy().to_string();
                    let folder = path.parent()
                        .and_then(|p| p.file_name())
                        .map(|f| f.to_string_lossy().to_string())
                        .unwrap_or_else(|| "Collection".to_string());
                    out.push(AudioFile {
                        path: path.to_string_lossy().to_string(),
                        filename,
                        folder,
                    });
                }
            }
        }
    }

    walk(base, base, &audio_exts, &mut files);
    files.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(files)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![ytdlp_search, ytdlp_stream, scan_music_dir])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
