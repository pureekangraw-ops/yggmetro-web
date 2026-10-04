import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const manifestPath=path.join(root,"android","app","src","main","AndroidManifest.xml");
const javaDir=path.join(root,"android","app","src","main","java","com","yggmetro","metro");
const mainPath=path.join(javaDir,"MainActivity.java");

if(!fs.existsSync(manifestPath)||!fs.existsSync(mainPath)){
  throw new Error("ANDROID_PROJECT_NOT_GENERATED");
}

let manifest=fs.readFileSync(manifestPath,"utf8");
const permissions=[
  '<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />',
  '<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />',
  '<uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />',
  '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />'
];
for(const permission of permissions){
  if(!manifest.includes(permission)) manifest=manifest.replace("<application",permission+"\n    <application");
}
const service=`
        <service
            android:name=".BubbleService"
            android:exported="false"
            android:foregroundServiceType="specialUse">
            <property
                android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
                android:value="Floating METRO entrance bubble shown only after explicit owner action" />
        </service>`;
if(!manifest.includes('android:name=".BubbleService"')) manifest=manifest.replace("</application>",service+"\n    </application>");\nconst prismActivity=`\n        <activity\n            android:name=".PrismActivity"\n            android:exported="false"\n            android:theme="@style/AppTheme.NoActionBar" />`;\nif(!manifest.includes('android:name=".PrismActivity"')) manifest=manifest.replace("</application>",prismActivity+"\n    </application>");
fs.writeFileSync(manifestPath,manifest);

fs.mkdirSync(javaDir,{recursive:true});
fs.writeFileSync(mainPath,`package com.yggmetro.metro;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(MetroBubblePlugin.class);
    super.onCreate(savedInstanceState);
  }
}
`);

fs.writeFileSync(path.join(javaDir,"MetroBubblePlugin.java"),`package com.yggmetro.metro;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "MetroBubble")
public class MetroBubblePlugin extends Plugin {
  @PluginMethod
  public void status(PluginCall call) {
    JSObject result = new JSObject();
    result.put("granted", Settings.canDrawOverlays(getContext()));
    result.put("running", BubbleService.isRunning());
    call.resolve(result);
  }

  @PluginMethod
  public void requestPermission(PluginCall call) {
    Intent intent = new Intent(
      Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
      Uri.parse("package:" + getContext().getPackageName())
    );
    getActivity().startActivity(intent);
    call.resolve();
  }

  @PluginMethod
  public void start(PluginCall call) {
    if (!Settings.canDrawOverlays(getContext())) {
      call.reject("OVERLAY_PERMISSION_REQUIRED");
      return;
    }
    Intent intent = new Intent(getContext(), BubbleService.class);
    intent.setAction(BubbleService.ACTION_START);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) getContext().startForegroundService(intent);
    else getContext().startService(intent);
    call.resolve();
  }

  @PluginMethod
  public void stop(PluginCall call) {
    Intent intent = new Intent(getContext(), BubbleService.class);
    intent.setAction(BubbleService.ACTION_STOP);
    getContext().startService(intent);
    call.resolve();
  }

  @PluginMethod
  public void openPrism(PluginCall call) {
    String url = call.getString("url");
    if (url == null || !(url.startsWith("https://") || url.startsWith("http://"))) {
      call.reject("PRISM_URL_INVALID");
      return;
    }
    Intent intent = new Intent(getContext(), PrismActivity.class);
    intent.putExtra("url", url);
    getActivity().startActivity(intent);
    call.resolve();
  }
}
`);

fs.writeFileSync(path.join(javaDir,"BubbleService.java"),`package com.yggmetro.metro;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.IBinder;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;

public class BubbleService extends Service {
  public static final String ACTION_START = "com.yggmetro.metro.BUBBLE_START";
  public static final String ACTION_STOP = "com.yggmetro.metro.BUBBLE_STOP";
  private static final String CHANNEL = "metro_bubble";
  private static volatile boolean running = false;
  private WindowManager windowManager;
  private TextView bubble;
  private WindowManager.LayoutParams params;

  public static boolean isRunning() { return running; }

  @Override public void onCreate() {
    super.onCreate();
    createChannel();
    startForeground(41, notification());
  }

  @Override public int onStartCommand(Intent intent, int flags, int startId) {
    if (intent != null && ACTION_STOP.equals(intent.getAction())) {
      stopSelf();
      return START_NOT_STICKY;
    }
    if (!android.provider.Settings.canDrawOverlays(this)) {
      stopSelf();
      return START_NOT_STICKY;
    }
    showBubble();
    return START_STICKY;
  }

  private void showBubble() {
    if (bubble != null) return;
    windowManager=(WindowManager)getSystemService(WINDOW_SERVICE);
    bubble=new TextView(this);
    bubble.setText("M");
    bubble.setTextColor(Color.WHITE);
    bubble.setTextSize(20);
    bubble.setGravity(Gravity.CENTER);
    bubble.setElevation(dp(10));
    GradientDrawable bg=new GradientDrawable();
    bg.setShape(GradientDrawable.OVAL);
    bg.setColor(Color.rgb(8,17,27));
    bg.setStroke(dp(1),Color.rgb(139,220,255));
    bubble.setBackground(bg);

    int type=Build.VERSION.SDK_INT>=Build.VERSION_CODES.O
      ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      : WindowManager.LayoutParams.TYPE_PHONE;
    params=new WindowManager.LayoutParams(
      dp(58),dp(58),type,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
      PixelFormat.TRANSLUCENT
    );
    params.gravity=Gravity.TOP|Gravity.START;
    int width=getResources().getDisplayMetrics().widthPixels;
    params.x=Math.max(dp(12),width-dp(78));
    params.y=dp(180);
    bubble.setOnTouchListener(new BubbleTouch());
    windowManager.addView(bubble,params);
    running=true;
  }

  private class BubbleTouch implements View.OnTouchListener {
    private int startX,startY;
    private float downX,downY;
    private long downAt;

    @Override public boolean onTouch(View view, MotionEvent event) {
      switch(event.getAction()){
        case MotionEvent.ACTION_DOWN:
          startX=params.x; startY=params.y; downX=event.getRawX(); downY=event.getRawY(); downAt=System.currentTimeMillis(); return true;
        case MotionEvent.ACTION_MOVE:
          params.x=startX+(int)(event.getRawX()-downX);
          params.y=startY+(int)(event.getRawY()-downY);
          windowManager.updateViewLayout(bubble,params); return true;
        case MotionEvent.ACTION_UP:
          float dx=Math.abs(event.getRawX()-downX),dy=Math.abs(event.getRawY()-downY);
          if(dx<dp(8)&&dy<dp(8)&&System.currentTimeMillis()-downAt<450) openMetro();
          else snapToEdge();
          return true;
        default:return false;
      }
    }
  }

  private void snapToEdge(){
    int width=getResources().getDisplayMetrics().widthPixels;
    params.x=params.x+dp(29)<width/2?dp(12):Math.max(dp(12),width-dp(70));
    if(bubble!=null) windowManager.updateViewLayout(bubble,params);
  }

  private void openMetro(){
    Intent intent=new Intent(this,MainActivity.class);
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
    startActivity(intent);
  }

  private void createChannel(){
    if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.O){
      NotificationChannel channel=new NotificationChannel(CHANNEL,"METRO Bubble",NotificationManager.IMPORTANCE_LOW);
      channel.setDescription("Keeps the owner-enabled METRO floating entrance available.");
      getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }
  }

  private Notification notification(){
    Intent open=new Intent(this,MainActivity.class);
    PendingIntent pending=PendingIntent.getActivity(this,0,open,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
    Notification.Builder builder=Build.VERSION.SDK_INT>=Build.VERSION_CODES.O
      ? new Notification.Builder(this,CHANNEL)
      : new Notification.Builder(this);
    return builder
      .setSmallIcon(android.R.drawable.ic_menu_compass)
      .setContentTitle("METRO Bubble")
      .setContentText("แตะ Bubble เพื่อกลับเข้า METRO")
      .setContentIntent(pending)
      .setOngoing(true)
      .build();
  }

  private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}

  private void removeBubble(){
    if(bubble!=null&&windowManager!=null){
      try{windowManager.removeView(bubble);}catch(Exception ignored){}
      bubble=null;
    }
    running=false;
  }

  @Override public void onDestroy(){
    removeBubble();
    stopForeground(true);
    super.onDestroy();
  }

  @Override public IBinder onBind(Intent intent){return null;}
}
`);

fs.writeFileSync(path.join(javaDir,"PrismActivity.java"),`package com.yggmetro.metro;

import android.annotation.SuppressLint;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.view.ViewGroup;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.app.Activity;

public class PrismActivity extends Activity {
  private WebView webView;

  @SuppressLint("SetJavaScriptEnabled")
  @Override protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    String url = getIntent().getStringExtra("url");
    if (url == null || !(url.startsWith("https://") || url.startsWith("http://"))) {
      finish();
      return;
    }

    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setBackgroundColor(Color.rgb(5, 9, 14));

    LinearLayout bar = new LinearLayout(this);
    bar.setGravity(Gravity.CENTER_VERTICAL);
    bar.setPadding(dp(10), dp(7), dp(10), dp(7));
    bar.setBackgroundColor(Color.rgb(8, 17, 27));

    Button back = new Button(this);
    back.setText("← METRO");
    back.setAllCaps(false);
    back.setOnClickListener(v -> finish());

    TextView title = new TextView(this);
    title.setText("PRISM · inside METRO");
    title.setTextColor(Color.WHITE);
    title.setTextSize(14);
    title.setGravity(Gravity.CENTER_VERTICAL);
    title.setPadding(dp(10), 0, 0, 0);

    bar.addView(back, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(48)));
    bar.addView(title, new LinearLayout.LayoutParams(0, dp(48), 1f));

    webView = new WebView(this);
    WebSettings settings = webView.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setAllowFileAccess(false);
    settings.setAllowContentAccess(false);
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

    webView.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        String next = request.getUrl().toString();
        return !(next.startsWith("https://") || next.startsWith("http://"));
      }
    });

    root.addView(bar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(62)));
    root.addView(webView, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
    setContentView(root);
    webView.loadUrl(url);
  }

  @Override public void onBackPressed() {
    if (webView != null && webView.canGoBack()) webView.goBack();
    else super.onBackPressed();
  }

  private int dp(int value) {
    return Math.round(value * getResources().getDisplayMetrics().density);
  }

  @Override protected void onDestroy() {
    if (webView != null) {
      webView.stopLoading();
      webView.destroy();
      webView = null;
    }
    super.onDestroy();
  }
}
`);

console.log("METRO floating bubble native layer installed");
