export function getFolderPaths() {
  const isWindows = navigator.userAgent.includes('Windows')
  const isMac = navigator.userAgent.includes('Mac')

  const paths = {
    sqlite: {
      name: 'SQLite (OPFS)',
      windows: 'C:\\Users\\pc\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\File System',
      mac: '~/Library/Application Support/Google/Chrome/Default/File System',
      linux: '~/.config/google-chrome/Default/File System',
    },
    indexeddb: {
      name: 'IndexedDB',
      windows: 'C:\\Users\\pc\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\IndexedDB',
      mac: '~/Library/Application Support/Google/Chrome/Default/IndexedDB',
      linux: '~/.config/google-chrome/Default/IndexedDB',
    },
    documents: {
      name: 'Documents (.data)',
      windows: 'C:\\Users\\pc\\Documents',
      mac: '~/Documents',
      linux: '~/Documents',
    },
  }

  const getPath = (key: keyof typeof paths) => {
    const pathObj = paths[key]
    if (isWindows) return pathObj.windows
    if (isMac) return pathObj.mac
    return pathObj.linux || pathObj.windows
  }

  return {
    sqlitePath: getPath('sqlite'),
    indexeddbPath: getPath('indexeddb'),
    documentsPath: getPath('documents'),
    isWindows,
    isMac,
  }
}

export function generateOpenScript(folderPath: string, folderName: string): string {
  const isWindows = navigator.userAgent.includes('Windows')
  const isMac = navigator.userAgent.includes('Mac')

  if (isWindows) {
    return `@echo off\r\necho 📁 Ouverture de ${folderName}...\r\nexplorer "${folderPath}"\r\npause`
  } else if (isMac) {
    return `#!/bin/bash\r\necho "📁 Ouverture de ${folderName}..."\r\nopen "${folderPath}"`
  } else {
    return `#!/bin/bash\r\necho "📁 Ouverture de ${folderName}..."\r\nxdg-open "${folderPath}"`
  }
}

export function downloadScript(content: string, filename: string) {
  const isWindows = navigator.userAgent.includes('Windows')
  const extension = isWindows ? 'bat' : 'sh'
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.${extension}`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
