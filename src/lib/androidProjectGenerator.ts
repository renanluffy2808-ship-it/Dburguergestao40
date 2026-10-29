import JSZip from 'jszip';

export interface AndroidFile {
  path: string;
  category: 'build' | 'manifest' | 'kotlin-ui' | 'res' | 'assets' | 'ci-cd' | 'docs';
  description: string;
  content: string;
}

export function getAndroidProjectFiles(): AndroidFile[] {
  return [
    // 1. Root & Gradle Build Files
    {
      path: 'build.gradle.kts',
      category: 'build',
      description: 'Configuração raiz do Gradle com plugins Android e Kotlin',
      content: `// Top-level build file where you can add configuration options common to all sub-projects/modules.
plugins {
    id("com.android.application") version "8.2.2" apply false
    id("org.jetbrains.kotlin.android") version "1.9.22" apply false
}
`,
    },
    {
      path: 'settings.gradle.kts',
      category: 'build',
      description: 'Definição do nome do projeto D Burger Gestão e repositórios Google/MavenCentral',
      content: `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "DBurgerGestao"
include(":app")
`,
    },
    {
      path: 'gradle.properties',
      category: 'build',
      description: 'Otimizações da JVM para compilação ultrarrápida no Android',
      content: `org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m -Dfile.encoding=UTF-8
android.useAndroidX=true
kotlin.code.style=official
android.nonTransitiveRClass=true
org.gradle.parallel=false
org.gradle.daemon=false
`,
    },
    {
      path: 'app/build.gradle.kts',
      category: 'build',
      description: 'Dependências do módulo App com suporte a WebView nativo de alta performance e AndroidX WebKit',
      content: `plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "br.com.dburger.gestao"
    compileSdk = 34

    defaultConfig {
        applicationId = "br.com.dburger.gestao"
        minSdk = 26
        targetSdk = 34
        versionCode = 4
        versionName = "2.6.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("androidx.activity:activity-ktx:1.8.2")
    implementation("androidx.webkit:webkit:1.10.0")
}
`,
    },
    {
      path: 'app/proguard-rules.pro',
      category: 'build',
      description: 'Regras de otimização ProGuard/R8 para compilação segura',
      content: `# ProGuard rules for D' Burger Gestao
-keepattributes *Annotation*
-dontwarn br.com.dburger.gestao.**
`,
    },

    // 2. Android Manifest
    {
      path: 'app/src/main/AndroidManifest.xml',
      category: 'manifest',
      description: 'Manifesto do aplicativo com aceleração de hardware e permissões locais',
      content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.CAMERA" />

    <queries>
        <package android:name="com.whatsapp" />
        <package android:name="com.whatsapp.w4b" />
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <data android:scheme="https" />
        </intent>
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <data android:scheme="http" />
        </intent>
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <data android:scheme="whatsapp" />
        </intent>
    </queries>

    <application
        android:allowBackup="true"
        android:icon="@drawable/app_icon"
        android:label="@string/app_name"
        android:roundIcon="@drawable/app_icon"
        android:supportsRtl="true"
        android:hardwareAccelerated="true"
        android:usesCleartextTraffic="true"
        android:theme="@android:style/Theme.Material.NoActionBar">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|keyboardHidden"
            android:windowSoftInputMode="adjustResize"
            android:theme="@android:style/Theme.Material.NoActionBar">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>

</manifest>
`,
    },

    // 3. Recursos XML
    {
      path: 'app/src/main/res/values/strings.xml',
      category: 'res',
      description: 'Nome nativo do aplicativo sem caracteres especiais que quebram o compilador',
      content: `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">DBurger Gestao</string>
</resources>
`,
    },
    {
      path: 'app/src/main/res/values/themes.xml',
      category: 'res',
      description: 'Tema nativo do aplicativo',
      content: `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.DBurgerGestao" parent="@android:style/Theme.Material.NoActionBar" />
</resources>
`,
    },

    // 4. Activity Nativa que hospeda o aplicativo com fidelidade 100% ao Preview
    {
      path: 'app/src/main/java/br/com/dburger/gestao/MainActivity.kt',
      category: 'kotlin-ui',
      description: 'Activity principal que carrega os assets do aplicativo embutidos 100% offline e autônomos',
      content: `package br.com.dburger.gestao

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.webkit.CookieManager
import android.webkit.ConsoleMessage
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.webkit.WebViewAssetLoader

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    // Launcher oficial para seleção de fotos/arquivos da galeria ou câmera
    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (filePathCallback != null) {
            val results: Array<Uri>? = if (result.resultCode == Activity.RESULT_OK) {
                val data = result.data
                if (data != null) {
                    val clipData = data.clipData
                    val dataString = data.dataString
                    if (clipData != null) {
                        Array(clipData.itemCount) { i -> clipData.getItemAt(i).uri }
                    } else if (dataString != null) {
                        arrayOf(Uri.parse(dataString))
                    } else {
                        null
                    }
                } else {
                    null
                }
            } else {
                null
            }
            filePathCallback?.onReceiveValue(results)
            filePathCallback = null
        }
    }

    companion object {
        const val LOCAL_APP_URL = "https://appassets.androidplatform.net/assets/www/index.html"
        const val FALLBACK_FILE_URL = "file:///android_asset/www/index.html"
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Tema Dark nas barras de status e navegação do celular
        window.statusBarColor = Color.parseColor("#09090B")
        window.navigationBarColor = Color.parseColor("#18181B")

        // AssetLoader oficial do AndroidX para servir os assets web embutidos
        val assetLoader = WebViewAssetLoader.Builder()
            .setDomain("appassets.androidplatform.net")
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .addPathHandler("/res/", WebViewAssetLoader.ResourcesPathHandler(this))
            .build()

        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)

        webView = WebView(this).apply {
            cookieManager.setAcceptThirdPartyCookies(this, true)
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                allowFileAccess = true
                allowContentAccess = true
                allowFileAccessFromFileURLs = true
                allowUniversalAccessFromFileURLs = true

                // Suporte a viewport mobile responsivo e Tailwind CSS
                useWideViewPort = true
                loadWithOverviewMode = true
                textZoom = 100

                cacheMode = WebSettings.LOAD_DEFAULT
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                mediaPlaybackRequiresUserGesture = false
                displayZoomControls = false
                builtInZoomControls = false
                setSupportZoom(false)
            }
            setBackgroundColor(Color.parseColor("#09090B"))
            scrollBarStyle = View.SCROLLBARS_INSIDE_OVERLAY
            isVerticalScrollBarEnabled = false

            webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                    android.util.Log.d(
                        "DBurgerApp",
                        "\${consoleMessage?.message()} [\${consoleMessage?.sourceId()}:\${consoleMessage?.lineNumber()}]"
                    )
                    return true
                }

                // Habilita upload de fotos, notas e comprovantes via galeria e câmera
                override fun onShowFileChooser(
                    webView: WebView?,
                    filePathCallback: ValueCallback<Array<Uri>>?,
                    fileChooserParams: FileChooserParams?
                ): Boolean {
                    this@MainActivity.filePathCallback?.onReceiveValue(null)
                    this@MainActivity.filePathCallback = filePathCallback

                    val intent = try {
                        fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                            type = "image/*"
                            addCategory(Intent.CATEGORY_OPENABLE)
                        }
                    } catch (e: Exception) {
                        Intent(Intent.ACTION_GET_CONTENT).apply {
                            type = "image/*"
                            addCategory(Intent.CATEGORY_OPENABLE)
                        }
                    }

                    val chooserIntent = Intent.createChooser(intent, "Selecionar Imagem ou Comprovante")
                    return try {
                        fileChooserLauncher.launch(chooserIntent)
                        true
                    } catch (e: Exception) {
                        this@MainActivity.filePathCallback?.onReceiveValue(null)
                        this@MainActivity.filePathCallback = null
                        false
                    }
                }
            }

            webViewClient = object : WebViewClient() {
                // Intercepta links externos (WhatsApp, telefone, e-mail, navegador)
                // Impede que o WebView saia da URL interna, evitando recarga e perda de dados
                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    request: WebResourceRequest
                ): Boolean {
                    val uri = request.url
                    val urlStr = uri.toString()
                    val host = uri.host ?: ""
                    val scheme = uri.scheme ?: ""

                    // URLs locais do aplicativo continuam dentro do WebView
                    if (host == "appassets.androidplatform.net" || scheme == "file") {
                        return false
                    }

                    // Links externos (WhatsApp wa.me, whatsapp://, tel:, mailto:, sites)
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                        startActivity(intent)
                    } catch (e: Exception) {
                        android.util.Log.w("DBurgerApp", "Nao foi possivel abrir link externo: $urlStr")
                    }
                    return true
                }

                override fun shouldInterceptRequest(
                    view: WebView,
                    request: WebResourceRequest
                ): WebResourceResponse? {
                    val url = request.url

                    // 1. Tenta o interceptador oficial do AndroidX
                    val response = assetLoader.shouldInterceptRequest(url)
                    if (response != null) {
                        return response
                    }

                    // 2. Interceptador de segurança para appassets.androidplatform.net (evita 404 e tela preta)
                    if (url.host == "appassets.androidplatform.net") {
                        var assetPath = url.path ?: ""
                        if (assetPath.startsWith("/assets/")) {
                            assetPath = assetPath.removePrefix("/assets/")
                        }
                        if (assetPath.startsWith("/")) {
                            assetPath = assetPath.removePrefix("/")
                        }
                        if (assetPath.isEmpty() || assetPath == "index.html") {
                            assetPath = "www/index.html"
                        } else if (!assetPath.startsWith("www/")) {
                            assetPath = "www/$assetPath"
                        }

                        try {
                            val stream = assets.open(assetPath)
                            val mime = when {
                                assetPath.endsWith(".html") -> "text/html"
                                assetPath.endsWith(".js") -> "application/javascript"
                                assetPath.endsWith(".css") -> "text/css"
                                assetPath.endsWith(".json") -> "application/json"
                                assetPath.endsWith(".png") -> "image/png"
                                assetPath.endsWith(".svg") -> "image/svg+xml"
                                else -> "application/octet-stream"
                            }
                            val headers = mapOf(
                                "Access-Control-Allow-Origin" to "*",
                                "Access-Control-Allow-Methods" to "GET, OPTIONS",
                                "Cache-Control" to "no-cache"
                            )
                            return WebResourceResponse(mime, "UTF-8", 200, "OK", headers, stream)
                        } catch (e: Exception) {
                            android.util.Log.w("DBurgerApp", "Asset local nao encontrado: $assetPath")
                        }
                    }

                    return null
                }

                override fun onReceivedError(
                    view: WebView,
                    request: WebResourceRequest,
                    error: WebResourceError
                ) {
                    super.onReceivedError(view, request, error)
                    android.util.Log.e("DBurgerApp", "Erro WebView: \${error.description} na URL: \${request.url}")
                    val host = request.url?.host ?: ""
                    if (request.isForMainFrame && host == "appassets.androidplatform.net") {
                        view.post {
                            view.loadUrl(FALLBACK_FILE_URL)
                        }
                    }
                }
            }
        }

        setContentView(webView)

        // Trata o botão Voltar físico/gestual do celular para navegar nas abas e fechar modais
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

        // Carrega a aplicação web 100% autônoma e offline embutida no próprio APK
        webView.loadUrl(LOCAL_APP_URL)
    }
}
`,
    },

    // 5. Assets Web do Preview embutidos no APK
    {
      path: 'app/src/main/assets/www/index.html',
      category: 'assets',
      description: 'Página HTML raiz do aplicativo idêntico com fontes e estilos completos',
      content: `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <title>D’ Burger Gestão & Cardápio Digital</title>
    <meta name="description" content="Sistema completo de gestão operacional, PDV, estoque e cardápio digital com checkout para WhatsApp, Pix integrado com confirmação real, entrega e retirada." />
    <meta property="og:title" content="D’ Burger Gestão & Cardápio Digital" />
    <meta property="og:description" content="Sistema completo de gestão operacional, PDV, estoque e cardápio digital com checkout para WhatsApp, Pix integrado com confirmação real, entrega e retirada." />
    <meta property="og:type" content="website" />
    <meta name="theme-color" content="#18181b" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <link rel="icon" type="image/svg+xml" href="./icon.svg" />
    <link rel="icon" type="image/png" sizes="192x192" href="./icon-192.png" />
    <link rel="apple-touch-icon" href="./apple-touch-icon.png" />
    <link rel="manifest" href="./manifest.json">
    <link rel="stylesheet" href="./assets/app.css">
  </head>
  <body class="bg-zinc-950 text-zinc-100 antialiased selection:bg-amber-500 selection:text-black">
    <div id="root">
      <div id="app-loading-screen" style="position:fixed;inset:0;background:#09090b;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif;color:#f4f4f5;z-index:99999;">
        <div style="width:44px;height:44px;border:3px solid #27272a;border-top-color:#f59e0b;border-radius:50%;animation:dburger-spin 0.8s linear infinite;"></div>
        <p style="margin-top:16px;font-size:14px;font-weight:800;letter-spacing:0.05em;color:#f4f4f5;">D’ BURGER GESTÃO</p>
        <p id="app-loading-status" style="margin-top:6px;font-size:12px;color:#a1a1aa;">Carregando painel e cardápio...</p>
        <div id="app-error-box" style="display:none;margin-top:14px;max-width:320px;padding:12px;background:#271b1b;border:1px solid #7f1d1d;border-radius:8px;font-size:11px;color:#fca5a5;word-break:break-word;text-align:center;"></div>
        <style>@keyframes dburger-spin{to{transform:rotate(360deg)}}</style>
      </div>
    </div>
    <script>
      window.addEventListener('error', function(e) {
        var errBox = document.getElementById('app-error-box');
        var errStatus = document.getElementById('app-loading-status');
        if (errBox) {
          errBox.style.display = 'block';
          errBox.textContent = 'Erro ao iniciar: ' + (e.message || e);
        }
        if (errStatus) {
          errStatus.textContent = 'Falha no carregamento dos componentes';
        }
      });
    </script>
    <script defer src="./assets/app.js"></script>
  </body>
</html>
`,
    },
    {
      path: 'app/src/main/assets/www/manifest.json',
      category: 'assets',
      description: 'Manifesto PWA do aplicativo',
      content: `{
  "id": "/",
  "name": "D’ Burger Gestão",
  "short_name": "D' Burger",
  "description": "Aplicativo de Gestão Financeira e Operacional para Hamburguerias Artesanais",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#09090b",
  "theme_color": "#18181b",
  "icons": [
    {
      "src": "./icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "./icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "./icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "./icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
`,
    },

    // 6. Workflow CI/CD GitHub Actions
    {
      path: '.github/workflows/build-apk.yml',
      category: 'ci-cd',
      description: 'Workflow do GitHub Actions para compilar APK Debug na nuvem automaticamente',
      content: `name: Build Android APK

on:
  push:
    branches: [ "main", "master" ]
  workflow_dispatch:

jobs:
  build:
    name: Compilar APK Android
    runs-on: ubuntu-latest

    steps:
    - name: Baixar codigo do repositorio
      uses: actions/checkout@v4

    - name: Extrair ZIP se existir
      run: |
        if ls *.zip 1> /dev/null 2>&1; then
          echo "Descompactando ZIP..."
          unzip -o *.zip
        fi
        if [ ! -f "settings.gradle.kts" ] && [ ! -f "settings.gradle" ]; then
          SUBDIR=$(find . -maxdepth 2 -name "settings.gradle*" -exec dirname {} \\; | head -n 1)
          if [ -n "$SUBDIR" ] && [ "$SUBDIR" != "." ]; then
            cp -r $SUBDIR/* .
          fi
        fi

    - name: Configurar Node.js (Garantir Bundle Web)
      uses: actions/setup-node@v4
      with:
        node-version: '20'
      continue-on-error: true

    - name: Compilar e Sincronizar Assets Web
      run: |
        mkdir -p app/src/main/assets/www/assets
        if [ -f "package.json" ]; then
          echo "Compilando web bundle com Vite..."
          npm ci || npm install || true
          npm run build || true
          if [ -d "dist" ]; then
            cp -r dist/* app/src/main/assets/www/ || true
          fi
          if [ -d "public/bundle" ]; then
            cp -r public/bundle/* app/src/main/assets/www/ || true
          fi
        fi
        echo "Arquivos em app/src/main/assets/www/:"
        ls -la app/src/main/assets/www/ || true
      continue-on-error: true

    - name: Configurar Java 17
      uses: actions/setup-java@v4
      with:
        distribution: 'temurin'
        java-version: '17'

    - name: Instalar Gradle 8.5
      uses: gradle/actions/setup-gradle@v4
      with:
        gradle-version: '8.5'
        cache-disabled: true

    - name: Aceitar Licencas do Android SDK
      run: |
        yes | $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --licenses || true
        echo "sdk.dir=$ANDROID_HOME" > local.properties

    - name: Garantir Recursos e Proguard
      run: |
        mkdir -p app/src/main/res/values
        mkdir -p app/src/main/res/drawable
        echo '<?xml version="1.0" encoding="utf-8"?>' > app/src/main/res/values/strings.xml
        echo '<resources><string name="app_name">DBurger Gestao</string></resources>' >> app/src/main/res/values/strings.xml
        echo '<?xml version="1.0" encoding="utf-8"?>' > app/src/main/res/values/themes.xml
        echo '<resources><style name="Theme.DBurgerGestao" parent="@android:style/Theme.Material.NoActionBar" /></resources>' >> app/src/main/res/values/themes.xml
        touch app/proguard-rules.pro

    - name: Compilar APK Android
      run: |
        chmod +x gradlew 2>/dev/null || true
        gradle assembleDebug --no-daemon --stacktrace

    - name: Salvar APK para Download
      uses: actions/upload-artifact@v4
      with:
        name: dburger-gestao-apk-v2.6.0
        path: app/build/outputs/apk/debug/*.apk
`,
    },

    // 7. Deploy na Nuvem (Render / Docker)
    {
      path: 'render.yaml',
      category: 'build',
      description: 'Configuração oficial de deploy no Render (Web Service Node.js)',
      content: `services:
  - type: web
    name: dburger-gestao
    env: node
    plan: free
    region: ohio
    buildCommand: npm install && npm run build
    startCommand: npm start
    healthCheckPath: /api/health
    autoDeploy: true
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3000
`,
    },
    {
      path: 'Dockerfile',
      category: 'build',
      description: 'Dockerfile multi-plataforma para deploy em contêiner',
      content: `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000
CMD ["npm", "start"]
`,
    },
    {
      path: '.dockerignore',
      category: 'build',
      description: 'Arquivos ignorados no build Docker',
      content: `node_modules
.git
dist
app/build
.gradle
`,
    },

    // 8. Manual do Aplicativo
    {
      path: 'README.md',
      category: 'docs',
      description: 'Manual de compilação e uso do aplicativo com equivalência total ao Preview',
      content: `# D’ Burger Gestão — Aplicativo Android Oficial (v2.6.0)

Aplicativo de gestão financeira e operacional completo para hamburguerias artesanais.
Versão Android nativa 100% autônoma e empacotada com o **mesmo código de alta fidelidade do Preview**:
- **Equivalência Visual Total**: Reproduz 1:1 o design, cores, tipografia e botões do Preview.
- **100% Autônomo e Offline**: O aplicativo roda diretamente com seus assets embutidos no APK (\`assets/www/index.html\`, \`assets/app.js\`, \`assets/app.css\`), sem depender de conexões instáveis para renderizar a interface.
- **Banco de Dados Local Persistente**: Produtos, adicionais, fluxo de caixa, pedidos e configurações ficam salvos na memória do celular.
- **Área Administrativa Completa**: Cardápio com fotos, adicionais, categorias e editor visual.
- **Cardápio Digital Público**: Acessível para clientes via link direto sem login obrigatório.
- **Operação Completa**: PDV, Insumos, Fichas Técnicas, Fluxo de Caixa nas 3 gavetas financeiras e Relatórios.

## 📱 Como Gerar e Instalar o Arquivo APK no Celular

### Opção 1: Pelo GitHub Actions (Sem Computador)
1. Crie um repositório no GitHub (ex: \`dburguer-oficial\`).
2. Envie os arquivos descompactados deste projeto para o repositório.
3. O GitHub Actions executará o fluxo de compilação automaticamente (leva cerca de 1 minuto).
4. Na aba **Actions**, toque na compilação concluída e baixe o artefato **dburger-gestao-apk-v2.6.0**.
5. **IMPORTANTE para evitar conflito:** Desinstale qualquer versão de teste anterior do aplicativo no seu celular (segure o ícone e toque em Desinstalar) antes de instalar o novo APK!
6. Toque no novo APK baixado e instale normalmente!

### Opção 2: Pelo Android Studio no Computador
1. Abra o Android Studio e selecione **Open**.
2. Abra a pasta deste projeto.
3. Aguarde a sincronização e clique em **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
4. O APK estará disponível em \`app/build/outputs/apk/debug/app-debug.apk\`.
`,
    },
  ];
}

export async function gerarZipProjetoAndroid(): Promise<Blob> {
  const zip = new JSZip();
  const files = getAndroidProjectFiles();

  for (const f of files) {
    zip.file(f.path, f.content);
  }

  // Adicionar gradlew wrapper executável
  zip.file(
    'gradlew',
    `#!/bin/sh
exec gradle "$@"
`
  );

  // Empacotar os arquivos web reais do Preview diretamente dentro do APK (100% idêntico e offline)
  try {
    const [htmlRes, jsRes, cssRes, manifestRes, icon192Res, icon512Res, iconSvgRes] = await Promise.all([
      fetch('/bundle/index.html'),
      fetch('/bundle/assets/app.js'),
      fetch('/bundle/assets/app.css'),
      fetch('/manifest.json'),
      fetch('/icon-192.png'),
      fetch('/icon-512.png'),
      fetch('/icon.svg'),
    ]);

    if (htmlRes.ok) {
      const htmlText = await htmlRes.text();
      zip.file('app/src/main/assets/www/index.html', htmlText);
    }

    if (jsRes.ok) {
      const jsBuf = await jsRes.arrayBuffer();
      zip.file('app/src/main/assets/www/assets/app.js', jsBuf);
    }

    if (cssRes.ok) {
      const cssBuf = await cssRes.arrayBuffer();
      zip.file('app/src/main/assets/www/assets/app.css', cssBuf);
    }

    if (manifestRes.ok) {
      const manifestText = await manifestRes.text();
      zip.file('app/src/main/assets/www/manifest.json', manifestText);
    }

    if (icon192Res.ok) {
      const icon192Buf = await icon192Res.arrayBuffer();
      zip.file('app/src/main/assets/www/icon-192.png', icon192Buf);
      zip.file('app/src/main/res/drawable/app_icon.png', icon192Buf);
    }

    if (icon512Res.ok) {
      const icon512Buf = await icon512Res.arrayBuffer();
      zip.file('app/src/main/assets/www/icon-512.png', icon512Buf);
    }

    if (iconSvgRes.ok) {
      const svgText = await iconSvgRes.text();
      zip.file('app/src/main/assets/www/icon.svg', svgText);
    }
  } catch (err) {
    console.error('Erro ao empacotar bundle web no ZIP:', err);
  }

  return await zip.generateAsync({ type: 'blob' });
}
