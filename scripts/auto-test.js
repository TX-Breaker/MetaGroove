#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');

class ExtensionTester {
  constructor() {
    this.extensionPath = path.resolve(__dirname, '..');
    this.results = {
      timestamp: new Date().toISOString(),
      tests: []
    };
  }

  async validateManifests() {
    console.log('🔍 Validating manifests...');
    
    const chromeManifestPath = path.join(this.extensionPath, 'manifest.json');
    const firefoxManifestPath = path.join(this.extensionPath, 'manifest-firefox.json');
    
    const chromeExists = await fs.pathExists(chromeManifestPath);
    const firefoxExists = await fs.pathExists(firefoxManifestPath);
    
    let chromeManifest = null;
    let firefoxManifest = null;
    
    if (chromeExists) {
      chromeManifest = await fs.readJson(chromeManifestPath);
    }
    
    if (firefoxExists) {
      firefoxManifest = await fs.readJson(firefoxManifestPath);
    }
    
    const result = {
      test: 'manifest_validation',
      success: chromeExists && firefoxExists,
      details: {
        chrome: {
          found: chromeExists,
          version: chromeManifest?.manifest_version,
          name: chromeManifest?.name,
          popup: chromeManifest?.action?.default_popup,
          contentScripts: chromeManifest?.content_scripts?.length || 0,
          permissions: chromeManifest?.permissions?.length || 0
        },
        firefox: {
          found: firefoxExists,
          version: firefoxManifest?.manifest_version,
          name: firefoxManifest?.name,
          popup: firefoxManifest?.browser_action?.default_popup,
          contentScripts: firefoxManifest?.content_scripts?.length || 0,
          permissions: firefoxManifest?.permissions?.length || 0
        }
      }
    };
    
    this.results.tests.push(result);
    
    if (result.success) {
      console.log('✅ Manifests validation passed');
    } else {
      console.log('❌ Manifests validation failed');
    }
    
    return result;
  }

  async validateFiles() {
    console.log('📁 Validating extension files...');
    
    const requiredFiles = [
      'src/popup/popup-redesigned.html',
      'src/popup/popup-redesigned.js',
      'src/popup/popup-redesigned.css',
      'src/content/youtube-minimal.js',
      'src/content/soundcloud-minimal.js',
      'src/background/service-worker-simple.js'
    ];
    
    const fileChecks = {};
    let allFilesExist = true;
    
    for (const file of requiredFiles) {
      const filePath = path.join(this.extensionPath, file);
      const exists = await fs.pathExists(filePath);
      fileChecks[file] = exists;
      
      if (!exists) {
        allFilesExist = false;
        console.log(`❌ Missing file: ${file}`);
      } else {
        console.log(`✅ Found file: ${file}`);
      }
    }
    
    const result = {
      test: 'file_validation',
      success: allFilesExist,
      details: {
        fileChecks,
        totalFiles: requiredFiles.length,
        foundFiles: Object.values(fileChecks).filter(Boolean).length
      }
    };
    
    this.results.tests.push(result);
    return result;
  }

  async testChromeExtension() {
    console.log('🌐 Testing Chrome extension...');
    
    let browser;
    try {
      // Avvia Chrome con l'estensione caricata
      browser = await puppeteer.launch({
        headless: true,
        args: [
          `--disable-extensions-except=${this.extensionPath}`,
          `--load-extension=${this.extensionPath}`,
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--allow-running-insecure-content'
        ]
      });

      const page = await browser.newPage();
      
      // Raccogli log della console
      const consoleLogs = [];
      page.on('console', (msg) => {
        consoleLogs.push(`${msg.type()}: ${msg.text()}`);
      });
      
      // Naviga a YouTube
      console.log('📺 Loading YouTube...');
      await page.goto('https://www.youtube.com', { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      // Aspetta che l'estensione si carichi
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Controlla se l'estensione è attiva
      const extensionStatus = await page.evaluate(() => {
        // Cerca elementi che indicano che MetaGroove è attivo
        const overlay = document.querySelector('#metagroove-overlay');
        const processedElements = document.querySelectorAll('[data-metagroove-processed]');
        
        return {
          overlayFound: !!overlay,
          overlayText: overlay?.textContent || null,
          processedElementsCount: processedElements.length,
          pageTitle: document.title,
          url: window.location.href
        };
      });
      
      // Fai uno screenshot
      const screenshot = await page.screenshot({ 
        encoding: 'base64',
        fullPage: false 
      });
      
      await browser.close();
      
      const result = {
        test: 'chrome_extension_test',
        success: extensionStatus.overlayFound || extensionStatus.processedElementsCount > 0,
        details: {
          extensionStatus,
          consoleLogs: consoleLogs.slice(-10),
          screenshot: `data:image/png;base64,${screenshot}`,
          testUrl: 'https://www.youtube.com'
        }
      };
      
      this.results.tests.push(result);
      
      if (result.success) {
        console.log('✅ Chrome extension test passed');
        console.log(`   - Overlay found: ${extensionStatus.overlayFound}`);
        console.log(`   - Processed elements: ${extensionStatus.processedElementsCount}`);
      } else {
        console.log('❌ Chrome extension test failed');
      }
      
      return result;
      
    } catch (error) {
      if (browser) {
        await browser.close();
      }
      
      const result = {
        test: 'chrome_extension_test',
        success: false,
        error: error.message,
        details: {
          errorType: error.constructor.name,
          stack: error.stack
        }
      };
      
      this.results.tests.push(result);
      console.log(`❌ Chrome extension test failed: ${error.message}`);
      return result;
    }
  }

  async launchChromeForManualTest() {
    console.log('🚀 Launching Chrome for manual testing...');
    
    try {
      const browser = await puppeteer.launch({
        headless: false,
        devtools: true,
        args: [
          `--disable-extensions-except=${this.extensionPath}`,
          `--load-extension=${this.extensionPath}`,
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-web-security',
          '--allow-running-insecure-content',
          '--start-maximized'
        ]
      });

      const page = await browser.newPage();
      await page.goto('https://www.youtube.com', { waitUntil: 'networkidle2' });
      
      console.log('✅ Chrome launched with extension loaded');
      console.log('   - Navigate to YouTube to test the extension');
      console.log('   - Click the extension icon to test the popup');
      console.log('   - Close the browser when done testing');
      
      return {
        success: true,
        message: 'Chrome launched successfully for manual testing'
      };
      
    } catch (error) {
      console.log(`❌ Failed to launch Chrome: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createFirefoxManifestV3() {
    console.log('🦊 Creating Firefox Manifest v3...');
    
    try {
      const chromeManifestPath = path.join(this.extensionPath, 'manifest.json');
      const chromeManifest = await fs.readJson(chromeManifestPath);
      
      // Crea un manifest Firefox v3 corretto
      const firefoxManifest = {
        manifest_version: 3,
        name: chromeManifest.name,
        version: chromeManifest.version,
        description: chromeManifest.description,
        
        background: {
          scripts: ["src/background/service-worker-simple.js"],
          type: "module"
        },
        
        content_scripts: chromeManifest.content_scripts,
        
        action: {
          default_popup: chromeManifest.action?.default_popup,
          default_title: chromeManifest.action?.default_title
        },
        
        permissions: chromeManifest.permissions,
        host_permissions: chromeManifest.host_permissions,
        
        browser_specific_settings: {
          gecko: {
            id: "metagroove@extension.com",
            strict_min_version: "109.0"
          }
        }
      };
      
      const outputPath = path.join(this.extensionPath, 'manifest-firefox-v3.json');
      await fs.writeJson(outputPath, firefoxManifest, { spaces: 2 });
      
      console.log('✅ Firefox Manifest v3 created successfully');
      console.log(`   - Output: manifest-firefox-v3.json`);
      
      return {
        success: true,
        outputFile: 'manifest-firefox-v3.json',
        manifest: firefoxManifest
      };
      
    } catch (error) {
      console.log(`❌ Failed to create Firefox manifest: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async runFullTest() {
    console.log('🎯 Running full extension test suite...\n');
    
    // 1. Valida manifests
    await this.validateManifests();
    console.log('');
    
    // 2. Valida files
    await this.validateFiles();
    console.log('');
    
    // 3. Testa su Chrome
    await this.testChromeExtension();
    console.log('');
    
    // 4. Crea manifest Firefox v3
    await this.createFirefoxManifestV3();
    console.log('');
    
    // Salva risultati
    const reportPath = path.join(this.extensionPath, 'test-results.json');
    await fs.writeJson(reportPath, this.results, { spaces: 2 });
    
    // Riassunto
    const totalTests = this.results.tests.length;
    const passedTests = this.results.tests.filter(t => t.success).length;
    
    console.log('📊 Test Summary:');
    console.log(`   - Total tests: ${totalTests}`);
    console.log(`   - Passed: ${passedTests}`);
    console.log(`   - Failed: ${totalTests - passedTests}`);
    console.log(`   - Report saved: test-results.json`);
    
    if (passedTests === totalTests) {
      console.log('\n🎉 All tests passed! Extension is ready for use.');
    } else {
      console.log('\n⚠️  Some tests failed. Check the report for details.');
    }
    
    return this.results;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'test';
  
  const tester = new ExtensionTester();
  
  switch (command) {
    case 'test':
      await tester.runFullTest();
      break;
      
    case 'launch':
      await tester.launchChromeForManualTest();
      break;
      
    case 'validate':
      await tester.validateManifests();
      await tester.validateFiles();
      break;
      
    case 'firefox':
      await tester.createFirefoxManifestV3();
      break;
      
    default:
      console.log('Usage:');
      console.log('  node auto-test.js test     - Run full test suite');
      console.log('  node auto-test.js launch   - Launch Chrome for manual testing');
      console.log('  node auto-test.js validate - Validate manifests and files only');
      console.log('  node auto-test.js firefox  - Create Firefox Manifest v3');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = ExtensionTester;