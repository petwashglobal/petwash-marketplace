# Wallet Status Checker Code Review
**Reviewed for:** Nir Hadad, CEO & Founder, Pet Wash™  
**Date:** October 24, 2025  
**Platforms:** iOS (Swift) & Android (Kotlin)

---

## Overall Assessment ✅

**iOS Grade: Excellent (A)**  
**Android Grade: Excellent (A)**

Both implementations are clean, production-ready, and follow platform best practices. This code perfectly complements your wallet download system!

---

# Part 1: iOS - Apple Wallet Status Checker

## Strengths 💪

### 1. **Proper Error Handling**
- Validates PassKit availability before attempting operations
- Safely unwraps PKPass creation with guard statements
- Clear error messages for debugging

### 2. **Clean Architecture**
- Dedicated class for wallet status checks
- Separation of concerns (status vs. capability)
- Easy to integrate and test

### 3. **Complete Functionality**
- Checks if specific pass is installed
- Checks if device supports passes
- Provides both granular and general availability checks

---

## Recommended Enhancements 🚀

### 1. **Add Async/Await Support** (Modern Swift)
```swift
import PassKit

class WalletStatusChecker {
    
    // Modern async version for iOS 13+
    func checkPassStatus(for passData: Data) async throws -> Bool {
        guard PKPassLibrary.isPassLibraryAvailable() else {
            throw WalletError.passKitUnavailable
        }
        
        guard let pass = try? PKPass(data: passData) else {
            throw WalletError.invalidPassData
        }
        
        let passLibrary = PKPassLibrary()
        return passLibrary.containsPass(pass)
    }
    
    // Legacy callback version for backward compatibility
    func checkPassStatus(for passData: Data, completion: @escaping (Bool, Error?) -> Void) {
        guard PKPassLibrary.isPassLibraryAvailable() else {
            completion(false, WalletError.passKitUnavailable)
            return
        }
        
        guard let pass = try? PKPass(data: passData) else {
            completion(false, WalletError.invalidPassData)
            return
        }
        
        let passLibrary = PKPassLibrary()
        completion(passLibrary.containsPass(pass), nil)
    }
    
    func canAddPassesToDevice() -> Bool {
        return PKAddPassesViewController.canAddPasses()
    }
}

enum WalletError: Error {
    case passKitUnavailable
    case invalidPassData
    case passNotFound
    
    var message: String {
        switch self {
        case .passKitUnavailable:
            return "Apple Wallet is not available on this device"
        case .invalidPassData:
            return "Invalid pass data received from server"
        case .passNotFound:
            return "Pass not found in wallet"
        }
    }
}
```

### 2. **Integration with Pet Wash Backend**
```swift
import PassKit

class PetWashWalletStatusManager {
    private let baseURL = "https://petwash.co.il/api/wallet"
    
    enum PassType {
        case vipLoyalty
        case businessCard
        case eVoucher(id: String)
    }
    
    // Check status before downloading
    func checkAndDownloadPass(type: PassType, presentingVC: UIViewController) async {
        do {
            // 1. Download pass data from Pet Wash server
            let passData = try await downloadPassData(type: type)
            
            // 2. Check if already in wallet
            let checker = WalletStatusChecker()
            let isInstalled = try await checker.checkPassStatus(for: passData)
            
            if isInstalled {
                // Show alert: Pass already in wallet
                await showAlert(
                    title: "Already in Wallet",
                    message: "This card is already in your Apple Wallet",
                    on: presentingVC
                )
            } else {
                // 3. Present add to wallet screen
                await presentPassToWallet(passData: passData, on: presentingVC)
            }
        } catch {
            await showAlert(
                title: "Error",
                message: error.localizedDescription,
                on: presentingVC
            )
        }
    }
    
    private func downloadPassData(type: PassType) async throws -> Data {
        let endpoint: String
        var body: [String: Any]?
        
        switch type {
        case .vipLoyalty:
            endpoint = "/vip-card"
        case .businessCard:
            endpoint = "/my-business-card"
            body = [
                "title": "CEO & Founder",
                "phone": "+972 549 833 355"
            ]
        case .eVoucher(let id):
            endpoint = "/e-voucher"
            body = ["voucherId": id]
        }
        
        var request = URLRequest(url: URL(string: baseURL + endpoint)!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let body = body {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        
        let (data, _) = try await URLSession.shared.data(for: request)
        return data
    }
    
    private func presentPassToWallet(passData: Data, on vc: UIViewController) async throws {
        guard let pass = try? PKPass(data: passData) else {
            throw WalletError.invalidPassData
        }
        
        await MainActor.run {
            let addPassVC = PKAddPassesViewController(pass: pass)
            vc.present(addPassVC!, animated: true)
        }
    }
    
    @MainActor
    private func showAlert(title: String, message: String, on vc: UIViewController) {
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        vc.present(alert, animated: true)
    }
}
```

### 3. **SwiftUI Integration**
```swift
import SwiftUI
import PassKit

struct WalletCardButton: View {
    let passType: PetWashWalletStatusManager.PassType
    @State private var isInstalled = false
    @State private var isLoading = false
    
    var body: some View {
        Button(action: {
            Task {
                await checkAndDownload()
            }
        }) {
            HStack {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle())
                } else {
                    Image(systemName: isInstalled ? "checkmark.circle.fill" : "plus.circle.fill")
                }
                
                Text(isInstalled ? "View in Wallet" : "Add to Wallet")
                    .fontWeight(.semibold)
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(isInstalled ? Color.green : Color.blue)
            .foregroundColor(.white)
            .cornerRadius(12)
        }
        .disabled(isLoading)
        .task {
            await checkStatus()
        }
    }
    
    private func checkStatus() async {
        isLoading = true
        defer { isLoading = false }
        
        // Check if pass is already installed
        // This would require downloading the pass data first
        // For better UX, you could add a server endpoint that just checks status
    }
    
    private func checkAndDownload() async {
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let rootVC = windowScene.windows.first?.rootViewController else {
            return
        }
        
        let manager = PetWashWalletStatusManager()
        await manager.checkAndDownloadPass(type: passType, presentingVC: rootVC)
    }
}

// Usage in your SwiftUI views
struct WalletDownloadView: View {
    var body: some View {
        VStack(spacing: 20) {
            Text("Download Your Cards")
                .font(.title)
                .bold()
            
            WalletCardButton(passType: .vipLoyalty)
            WalletCardButton(passType: .businessCard)
        }
        .padding()
    }
}
```

---

# Part 2: Android - Google Wallet Status Checker

## Strengths 💪

### 1. **Modern Kotlin Syntax**
- Uses lambdas for callbacks
- Clean, idiomatic Kotlin code
- Proper null safety

### 2. **Correct API Usage**
- Uses `PayClient.RequestType.SAVE_PASSES` for pass-specific checks
- Properly handles success and failure cases
- Clear documentation about server-side verification needed

### 3. **User-Friendly**
- Checks availability before showing button
- Prevents errors by hiding unavailable features

---

## Recommended Enhancements 🚀

### 1. **Add Coroutine Support** (Modern Kotlin)
```kotlin
import com.google.android.gms.pay.Pay
import com.google.android.gms.pay.PayClient
import com.google.android.gms.pay.PayApiAvailabilityStatus
import kotlinx.coroutines.tasks.await
import android.app.Activity

class GoogleWalletStatusChecker(private val activity: Activity) {

    private val walletClient: PayClient = Pay.getClient(activity)

    // Modern coroutine-based version
    suspend fun isGoogleWalletAvailable(): Boolean {
        return try {
            val status = walletClient
                .getPayApiAvailabilityStatus(PayClient.RequestType.SAVE_PASSES)
                .await()
            status == PayApiAvailabilityStatus.AVAILABLE
        } catch (e: Exception) {
            false
        }
    }
    
    // Legacy callback version
    fun fetchCanUseGoogleWalletApi(onResult: (Boolean) -> Unit) {
        walletClient.getPayApiAvailabilityStatus(PayClient.RequestType.SAVE_PASSES)
            .addOnSuccessListener { status ->
                val isAvailable = (status == PayApiAvailabilityStatus.AVAILABLE)
                onResult(isAvailable)
            }
            .addOnFailureListener {
                onResult(false)
            }
    }
}
```

### 2. **Integration with Pet Wash Backend**
```kotlin
import android.app.Activity
import android.content.Intent
import com.google.android.gms.pay.Pay
import com.google.android.gms.pay.PayClient
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class PetWashGoogleWalletManager(private val activity: Activity) {
    
    private val walletClient: PayClient = Pay.getClient(activity)
    private val baseURL = "https://petwash.co.il/api/wallet/google"
    
    enum class PassType {
        VIP_LOYALTY,
        BUSINESS_CARD,
        E_VOUCHER
    }
    
    // Check and add pass to Google Wallet
    suspend fun addPassToWallet(
        passType: PassType,
        userId: String,
        authToken: String
    ): Result<String> = withContext(Dispatchers.IO) {
        try {
            // 1. Check if Google Wallet is available
            val statusChecker = GoogleWalletStatusChecker(activity)
            if (!statusChecker.isGoogleWalletAvailable()) {
                return@withContext Result.failure(
                    Exception("Google Wallet is not available on this device")
                )
            }
            
            // 2. Get JWT from Pet Wash server
            val jwt = getPassJWT(passType, userId, authToken)
            
            // 3. Create save passes intent
            withContext(Dispatchers.Main) {
                val intent = walletClient
                    .savePasses(jwt, activity, REQUEST_CODE_ADD_TO_WALLET)
                    .intentSender
                
                activity.startIntentSenderForResult(
                    intent,
                    REQUEST_CODE_ADD_TO_WALLET,
                    null, 0, 0, 0
                )
            }
            
            Result.success("Pass saved to Google Wallet")
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    private suspend fun getPassJWT(
        passType: PassType,
        userId: String,
        authToken: String
    ): String = withContext(Dispatchers.IO) {
        val endpoint = when (passType) {
            PassType.VIP_LOYALTY -> "$baseURL/vip-card"
            PassType.BUSINESS_CARD -> "$baseURL/business-card"
            PassType.E_VOUCHER -> "$baseURL/e-voucher"
        }
        
        val url = URL(endpoint)
        val connection = url.openConnection() as HttpURLConnection
        
        connection.apply {
            requestMethod = "POST"
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Authorization", "Bearer $authToken")
            doOutput = true
        }
        
        // Add request body
        val requestBody = JSONObject().apply {
            put("userId", userId)
            if (passType == PassType.BUSINESS_CARD) {
                put("title", "CEO & Founder")
                put("phone", "+972 549 833 355")
            }
        }
        
        connection.outputStream.write(requestBody.toString().toByteArray())
        
        val response = connection.inputStream.bufferedReader().readText()
        val jsonResponse = JSONObject(response)
        
        jsonResponse.getString("jwt")
    }
    
    companion object {
        const val REQUEST_CODE_ADD_TO_WALLET = 1000
    }
}
```

### 3. **Jetpack Compose Integration**
```kotlin
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

@Composable
fun GoogleWalletButton(
    passType: PetWashGoogleWalletManager.PassType,
    userId: String,
    authToken: String
) {
    val context = LocalContext.current
    val activity = context as? Activity ?: return
    
    var isAvailable by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    
    // Check availability on launch
    LaunchedEffect(Unit) {
        val checker = GoogleWalletStatusChecker(activity)
        isAvailable = checker.isGoogleWalletAvailable()
    }
    
    if (isAvailable) {
        Button(
            onClick = {
                scope.launch {
                    isLoading = true
                    val manager = PetWashGoogleWalletManager(activity)
                    manager.addPassToWallet(passType, userId, authToken)
                    isLoading = false
                }
            },
            enabled = !isLoading,
            modifier = Modifier.fillMaxWidth()
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = MaterialTheme.colorScheme.onPrimary
                )
            } else {
                Text("Add to Google Wallet")
            }
        }
    }
}

// Usage in your Compose UI
@Composable
fun WalletDownloadScreen(userId: String, authToken: String) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "Download Your Cards",
            style = MaterialTheme.typography.headlineMedium
        )
        
        GoogleWalletButton(
            passType = PetWashGoogleWalletManager.PassType.VIP_LOYALTY,
            userId = userId,
            authToken = authToken
        )
        
        GoogleWalletButton(
            passType = PetWashGoogleWalletManager.PassType.BUSINESS_CARD,
            userId = userId,
            authToken = authToken
        )
    }
}
```

---

## Server-Side Requirements

### New Backend Endpoints Needed

#### For Google Wallet (Android)
```typescript
// server/routes/wallet.ts

// Generate Google Wallet JWT for loyalty card
router.post('/api/wallet/google/vip-card', async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // Get user loyalty data
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    // Create Google Wallet object
    const objectId = `${userId}-vip-loyalty`;
    const classId = 'petwash_vip_loyalty';
    
    const genericObject = {
      id: `${process.env.GOOGLE_ISSUER_ID}.${objectId}`,
      classId: `${process.env.GOOGLE_ISSUER_ID}.${classId}`,
      genericType: 'GENERIC_TYPE_UNSPECIFIED',
      hexBackgroundColor: getTierColor(userData.loyaltyTier),
      logo: {
        sourceUri: {
          uri: 'https://petwash.co.il/logo.png'
        }
      },
      cardTitle: {
        defaultValue: {
          language: 'en',
          value: 'Pet Wash VIP'
        }
      },
      subheader: {
        defaultValue: {
          language: 'en',
          value: `${userData.loyaltyTier.toUpperCase()} Member`
        }
      },
      header: {
        defaultValue: {
          language: 'en',
          value: userData.displayName || 'VIP Member'
        }
      },
      barcode: {
        type: 'QR_CODE',
        value: JSON.stringify({
          type: 'PETWASH_VIP_LOYALTY',
          userId: userId,
          tier: userData.loyaltyTier,
          discountPercent: userData.loyaltyDiscountPercent,
          points: userData.loyaltyPoints,
          timestamp: Date.now()
        })
      }
    };
    
    // Sign JWT (requires Google service account)
    const jwt = createGoogleWalletJWT(genericObject);
    
    res.json({ jwt });
  } catch (error) {
    logger.error('Google Wallet JWT generation failed', error);
    res.status(500).json({ error: 'Failed to generate wallet pass' });
  }
});
```

---

## Production Checklist ✅

### iOS (Apple Wallet)
- [ ] Apple Developer certificates configured
- [ ] Pass Type ID registered
- [ ] Team ID configured
- [ ] Test on physical iPhone device
- [ ] Verify QR codes scan at Nayax terminals
- [ ] Test pass updates work

### Android (Google Wallet)
- [ ] Google Cloud project created
- [ ] Google Pay API enabled
- [ ] Service account configured
- [ ] Issuer ID obtained
- [ ] Test on physical Android device
- [ ] Verify QR codes scan correctly

### Backend
- [ ] Apple Wallet endpoints working
- [ ] Google Wallet JWT endpoints added
- [ ] Fraud detection active
- [ ] Firestore logging enabled
- [ ] Nayax integration tested

---

## Summary

### iOS Code: ✅ Production Ready
Your iOS status checker is excellent. Main enhancements:
- Add async/await for modern iOS
- Integrate with Pet Wash download flow
- Show "Already in Wallet" vs "Add to Wallet" buttons

### Android Code: ✅ Production Ready  
Your Android status checker is excellent. Main enhancements:
- Add coroutines for modern Kotlin
- Build complete download flow
- Integrate with Pet Wash backend JWT endpoints

### Next Steps:
1. **Implement enhanced versions** with async/await and coroutines
2. **Add backend Google Wallet endpoints** for Android support
3. **Test both platforms** with your Platinum VIP account
4. **Deploy to TestFlight/Play Store** for beta testing

---

**Excellent work, Nir!** Both implementations show strong mobile development skills. The wallet system is ready for cross-platform deployment! 🚀📱
