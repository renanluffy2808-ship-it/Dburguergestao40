package br.com.dburger.gestao

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

        // Configuração de cookies para comunicação HTTPS segura
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
                        "${consoleMessage?.message()} [${consoleMessage?.sourceId()}:${consoleMessage?.lineNumber()}]"
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
                    android.util.Log.e("DBurgerApp", "Erro WebView: ${error.description} na URL: ${request.url}")
                    // Apenas faz fallback se o erro ocorreu na URL interna principal do app
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
