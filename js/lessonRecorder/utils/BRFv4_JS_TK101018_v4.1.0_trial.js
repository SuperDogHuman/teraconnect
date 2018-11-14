require('os')
require('https')

export function initializeBRF(brfv4) {
  var brfv4SDK = function(brfv4SDK) {
      brfv4SDK = brfv4SDK || {};
      var Module = typeof brfv4SDK !== "undefined" ? brfv4SDK : {};
      var moduleOverrides = {};
      var key;
      for (key in Module) {
          if (Module.hasOwnProperty(key)) {
              moduleOverrides[key] = Module[key]
          }
      }
      Module["arguments"] = [];
      Module["thisProgram"] = "./this.program";
      Module["quit"] = (function(status, toThrow) {
          throw toThrow
      });
      Module["preRun"] = [];
      Module["postRun"] = [];
      var ENVIRONMENT_IS_WEB = true;
      var ENVIRONMENT_IS_WORKER = false;
      if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
          Module["read"] = function shell_read(url) {
              var xhr = new XMLHttpRequest;
              xhr.open("GET", url, false);
              xhr.send(null);
              return xhr.responseText
          };
          if (ENVIRONMENT_IS_WORKER) {
              Module["readBinary"] = function readBinary(url) {
                  var xhr = new XMLHttpRequest;
                  xhr.open("GET", url, false);
                  xhr.responseType = "arraybuffer";
                  xhr.send(null);
                  return new Uint8Array(xhr.response)
              }
          }
          Module["readAsync"] = function readAsync(url, onload, onerror) {
              var xhr = new XMLHttpRequest;
              xhr.open("GET", url, true);
              xhr.responseType = "arraybuffer";
              xhr.onload = function xhr_onload() {
                  if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
                      onload(xhr.response);
                      return
                  }
                  onerror()
              };
              xhr.onerror = onerror;
              xhr.send(null)
          };
          Module["setWindowTitle"] = (function(title) {
              document.title = title
          })
      } else {}
      var out = Module["print"] || (typeof console !== "undefined" ? console.log.bind(console) : typeof print !== "undefined" ? print : null);
      var err = Module["printErr"] || (typeof printErr !== "undefined" ? printErr : typeof console !== "undefined" && console.warn.bind(console) || out);
      for (key in moduleOverrides) {
          if (moduleOverrides.hasOwnProperty(key)) {
              Module[key] = moduleOverrides[key]
          }
      }
      moduleOverrides = undefined;
      var STACK_ALIGN = 16;

      function staticAlloc(size) {
          var ret = STATICTOP;
          STATICTOP = STATICTOP + size + 15 & -16;
          return ret
      }

      function alignMemory(size, factor) {
          if (!factor) factor = STACK_ALIGN;
          var ret = size = Math.ceil(size / factor) * factor;
          return ret
      }
      var asm2wasmImports = {
          "f64-rem": (function(x, y) {
              return x % y
          }),
          "debugger": (function() {
              debugger
          })
      };
      var functionPointers = new Array(0);

      function dynCall(sig, ptr, args) {
          if (args && args.length) {
              return Module["dynCall_" + sig].apply(null, [ptr].concat(args))
          } else {
              return Module["dynCall_" + sig].call(null, ptr)
          }
      }
      var GLOBAL_BASE = 1024;
      var ABORT = 0;
      var EXITSTATUS = 0;

      function assert(condition, text) {
          if (!condition) {
              abort("Assertion failed: " + text)
          }
      }

      function getCFunc(ident) {
          var func = Module["_" + ident];
          assert(func, "Cannot call unknown function " + ident + ", make sure it is exported");
          return func
      }
      var JSfuncs = {
          "stackSave": (function() {
              stackSave()
          }),
          "stackRestore": (function() {
              stackRestore()
          }),
          "arrayToC": (function(arr) {
              var ret = stackAlloc(arr.length);
              writeArrayToMemory(arr, ret);
              return ret
          }),
          "stringToC": (function(str) {
              var ret = 0;
              if (str !== null && str !== undefined && str !== 0) {
                  var len = (str.length << 2) + 1;
                  ret = stackAlloc(len);
                  stringToUTF8(str, ret, len)
              }
              return ret
          })
      };
      var toC = {
          "string": JSfuncs["stringToC"],
          "array": JSfuncs["arrayToC"]
      };

      function ccall(ident, returnType, argTypes, args, opts) {
          function convertReturnValue(ret) {
              if (returnType === "string") return Pointer_stringify(ret);
              if (returnType === "boolean") return Boolean(ret);
              return ret
          }
          var func = getCFunc(ident);
          var cArgs = [];
          var stack = 0;
          if (args) {
              for (var i = 0; i < args.length; i++) {
                  var converter = toC[argTypes[i]];
                  if (converter) {
                      if (stack === 0) stack = stackSave();
                      cArgs[i] = converter(args[i])
                  } else {
                      cArgs[i] = args[i]
                  }
              }
          }
          var ret = func.apply(null, cArgs);
          ret = convertReturnValue(ret);
          if (stack !== 0) stackRestore(stack);
          return ret
      }

      function cwrap(ident, returnType, argTypes, opts) {
          argTypes = argTypes || [];
          var numericArgs = argTypes.every((function(type) {
              return type === "number"
          }));
          var numericRet = returnType !== "string";
          if (numericRet && numericArgs && !opts) {
              return getCFunc(ident)
          }
          return (function() {
              return ccall(ident, returnType, argTypes, arguments, opts)
          })
      }

      function Pointer_stringify(ptr, length) {
          if (length === 0 || !ptr) return "";
          var hasUtf = 0;
          var t;
          var i = 0;
          while (1) {
              t = HEAPU8[ptr + i >> 0];
              hasUtf |= t;
              if (t == 0 && !length) break;
              i++;
              if (length && i == length) break
          }
          if (!length) length = i;
          var ret = "";
          if (hasUtf < 128) {
              var MAX_CHUNK = 1024;
              var curr;
              while (length > 0) {
                  curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
                  ret = ret ? ret + curr : curr;
                  ptr += MAX_CHUNK;
                  length -= MAX_CHUNK
              }
              return ret
          }
          return UTF8ToString(ptr)
      }
      var UTF8Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf8") : undefined;

      function UTF8ArrayToString(u8Array, idx) {
          var endPtr = idx;
          while (u8Array[endPtr]) ++endPtr;
          if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
              return UTF8Decoder.decode(u8Array.subarray(idx, endPtr))
          } else {
              var u0, u1, u2, u3, u4, u5;
              var str = "";
              while (1) {
                  u0 = u8Array[idx++];
                  if (!u0) return str;
                  if (!(u0 & 128)) {
                      str += String.fromCharCode(u0);
                      continue
                  }
                  u1 = u8Array[idx++] & 63;
                  if ((u0 & 224) == 192) {
                      str += String.fromCharCode((u0 & 31) << 6 | u1);
                      continue
                  }
                  u2 = u8Array[idx++] & 63;
                  if ((u0 & 240) == 224) {
                      u0 = (u0 & 15) << 12 | u1 << 6 | u2
                  } else {
                      u3 = u8Array[idx++] & 63;
                      if ((u0 & 248) == 240) {
                          u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | u3
                      } else {
                          u4 = u8Array[idx++] & 63;
                          if ((u0 & 252) == 248) {
                              u0 = (u0 & 3) << 24 | u1 << 18 | u2 << 12 | u3 << 6 | u4
                          } else {
                              u5 = u8Array[idx++] & 63;
                              u0 = (u0 & 1) << 30 | u1 << 24 | u2 << 18 | u3 << 12 | u4 << 6 | u5
                          }
                      }
                  }
                  if (u0 < 65536) {
                      str += String.fromCharCode(u0)
                  } else {
                      var ch = u0 - 65536;
                      str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023)
                  }
              }
          }
      }

      function UTF8ToString(ptr) {
          return UTF8ArrayToString(HEAPU8, ptr)
      }

      function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
          if (!(maxBytesToWrite > 0)) return 0;
          var startIdx = outIdx;
          var endIdx = outIdx + maxBytesToWrite - 1;
          for (var i = 0; i < str.length; ++i) {
              var u = str.charCodeAt(i);
              if (u >= 55296 && u <= 57343) u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023;
              if (u <= 127) {
                  if (outIdx >= endIdx) break;
                  outU8Array[outIdx++] = u
              } else if (u <= 2047) {
                  if (outIdx + 1 >= endIdx) break;
                  outU8Array[outIdx++] = 192 | u >> 6;
                  outU8Array[outIdx++] = 128 | u & 63
              } else if (u <= 65535) {
                  if (outIdx + 2 >= endIdx) break;
                  outU8Array[outIdx++] = 224 | u >> 12;
                  outU8Array[outIdx++] = 128 | u >> 6 & 63;
                  outU8Array[outIdx++] = 128 | u & 63
              } else if (u <= 2097151) {
                  if (outIdx + 3 >= endIdx) break;
                  outU8Array[outIdx++] = 240 | u >> 18;
                  outU8Array[outIdx++] = 128 | u >> 12 & 63;
                  outU8Array[outIdx++] = 128 | u >> 6 & 63;
                  outU8Array[outIdx++] = 128 | u & 63
              } else if (u <= 67108863) {
                  if (outIdx + 4 >= endIdx) break;
                  outU8Array[outIdx++] = 248 | u >> 24;
                  outU8Array[outIdx++] = 128 | u >> 18 & 63;
                  outU8Array[outIdx++] = 128 | u >> 12 & 63;
                  outU8Array[outIdx++] = 128 | u >> 6 & 63;
                  outU8Array[outIdx++] = 128 | u & 63
              } else {
                  if (outIdx + 5 >= endIdx) break;
                  outU8Array[outIdx++] = 252 | u >> 30;
                  outU8Array[outIdx++] = 128 | u >> 24 & 63;
                  outU8Array[outIdx++] = 128 | u >> 18 & 63;
                  outU8Array[outIdx++] = 128 | u >> 12 & 63;
                  outU8Array[outIdx++] = 128 | u >> 6 & 63;
                  outU8Array[outIdx++] = 128 | u & 63
              }
          }
          outU8Array[outIdx] = 0;
          return outIdx - startIdx
      }

      function stringToUTF8(str, outPtr, maxBytesToWrite) {
          return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite)
      }

      function lengthBytesUTF8(str) {
          var len = 0;
          for (var i = 0; i < str.length; ++i) {
              var u = str.charCodeAt(i);
              if (u >= 55296 && u <= 57343) u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023;
              if (u <= 127) {
                  ++len
              } else if (u <= 2047) {
                  len += 2
              } else if (u <= 65535) {
                  len += 3
              } else if (u <= 2097151) {
                  len += 4
              } else if (u <= 67108863) {
                  len += 5
              } else {
                  len += 6
              }
          }
          return len
      }
      var UTF16Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-16le") : undefined;

      function stringToUTF32(str, outPtr, maxBytesToWrite) {
          if (maxBytesToWrite === undefined) {
              maxBytesToWrite = 2147483647
          }
          if (maxBytesToWrite < 4) return 0;
          var startPtr = outPtr;
          var endPtr = startPtr + maxBytesToWrite - 4;
          for (var i = 0; i < str.length; ++i) {
              var codeUnit = str.charCodeAt(i);
              if (codeUnit >= 55296 && codeUnit <= 57343) {
                  var trailSurrogate = str.charCodeAt(++i);
                  codeUnit = 65536 + ((codeUnit & 1023) << 10) | trailSurrogate & 1023
              }
              HEAP32[outPtr >> 2] = codeUnit;
              outPtr += 4;
              if (outPtr + 4 > endPtr) break
          }
          HEAP32[outPtr >> 2] = 0;
          return outPtr - startPtr
      }

      function lengthBytesUTF32(str) {
          var len = 0;
          for (var i = 0; i < str.length; ++i) {
              var codeUnit = str.charCodeAt(i);
              if (codeUnit >= 55296 && codeUnit <= 57343) ++i;
              len += 4
          }
          return len
      }

      function allocateUTF8(str) {
          var size = lengthBytesUTF8(str) + 1;
          var ret = _malloc(size);
          if (ret) stringToUTF8Array(str, HEAP8, ret, size);
          return ret
      }

      function allocateUTF8OnStack(str) {
          var size = lengthBytesUTF8(str) + 1;
          var ret = stackAlloc(size);
          stringToUTF8Array(str, HEAP8, ret, size);
          return ret
      }
      var WASM_PAGE_SIZE = 65536;
      var ASMJS_PAGE_SIZE = 16777216;
      var MIN_TOTAL_MEMORY = 16777216;

      function alignUp(x, multiple) {
          if (x % multiple > 0) {
              x += multiple - x % multiple
          }
          return x
      }
      var buffer, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;

      function updateGlobalBuffer(buf) {
          Module["buffer"] = buffer = buf
      }

      function updateGlobalBufferViews() {
          Module["HEAP8"] = HEAP8 = new Int8Array(buffer);
          Module["HEAP16"] = HEAP16 = new Int16Array(buffer);
          Module["HEAP32"] = HEAP32 = new Int32Array(buffer);
          Module["HEAPU8"] = HEAPU8 = new Uint8Array(buffer);
          Module["HEAPU16"] = HEAPU16 = new Uint16Array(buffer);
          Module["HEAPU32"] = HEAPU32 = new Uint32Array(buffer);
          Module["HEAPF32"] = HEAPF32 = new Float32Array(buffer);
          Module["HEAPF64"] = HEAPF64 = new Float64Array(buffer)
      }
      var STATIC_BASE, STATICTOP, staticSealed;
      var STACK_BASE, STACKTOP, STACK_MAX;
      var DYNAMIC_BASE, DYNAMICTOP_PTR;
      STATIC_BASE = STATICTOP = STACK_BASE = STACKTOP = STACK_MAX = DYNAMIC_BASE = DYNAMICTOP_PTR = 0;
      staticSealed = false;

      function abortOnCannotGrowMemory() {
          abort("Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value " + TOTAL_MEMORY + ", (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime, or (3) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ")
      }
      if (!Module["reallocBuffer"]) Module["reallocBuffer"] = (function(size) {
          var ret;
          try {
              if (ArrayBuffer.transfer) {
                  ret = ArrayBuffer.transfer(buffer, size)
              } else {
                  var oldHEAP8 = HEAP8;
                  ret = new ArrayBuffer(size);
                  var temp = new Int8Array(ret);
                  temp.set(oldHEAP8)
              }
          } catch (e) {
              return false
          }
          var success = _emscripten_replace_memory(ret);
          if (!success) return false;
          return ret
      });

      function enlargeMemory() {
          var PAGE_MULTIPLE = Module["usingWasm"] ? WASM_PAGE_SIZE : ASMJS_PAGE_SIZE;
          var LIMIT = 2147483648 - PAGE_MULTIPLE;
          if (HEAP32[DYNAMICTOP_PTR >> 2] > LIMIT) {
              return false
          }
          var OLD_TOTAL_MEMORY = TOTAL_MEMORY;
          TOTAL_MEMORY = Math.max(TOTAL_MEMORY, MIN_TOTAL_MEMORY);
          while (TOTAL_MEMORY < HEAP32[DYNAMICTOP_PTR >> 2]) {
              if (TOTAL_MEMORY <= 536870912) {
                  TOTAL_MEMORY = alignUp(2 * TOTAL_MEMORY, PAGE_MULTIPLE)
              } else {
                  TOTAL_MEMORY = Math.min(alignUp((3 * TOTAL_MEMORY + 2147483648) / 4, PAGE_MULTIPLE), LIMIT)
              }
          }
          var replacement = Module["reallocBuffer"](TOTAL_MEMORY);
          if (!replacement || replacement.byteLength != TOTAL_MEMORY) {
              TOTAL_MEMORY = OLD_TOTAL_MEMORY;
              return false
          }
          updateGlobalBuffer(replacement);
          updateGlobalBufferViews();
          return true
      }
      var byteLength;
      try {
          byteLength = Function.prototype.call.bind(Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength").get);
          byteLength(new ArrayBuffer(4))
      } catch (e) {
          byteLength = (function(buffer) {
              return buffer.byteLength
          })
      }
      var TOTAL_STACK = Module["TOTAL_STACK"] || 2097152;
      var TOTAL_MEMORY = Module["TOTAL_MEMORY"] || 268435456;
      if (TOTAL_MEMORY < TOTAL_STACK) err("TOTAL_MEMORY should be larger than TOTAL_STACK, was " + TOTAL_MEMORY + "! (TOTAL_STACK=" + TOTAL_STACK + ")");
      if (Module["buffer"]) {
          buffer = Module["buffer"]
      } else {
          if (typeof WebAssembly === "object" && typeof WebAssembly.Memory === "function") {
              Module["wasmMemory"] = new WebAssembly.Memory({
                  "initial": TOTAL_MEMORY / WASM_PAGE_SIZE
              });
              buffer = Module["wasmMemory"].buffer
          } else {
              buffer = new ArrayBuffer(TOTAL_MEMORY)
          }
          Module["buffer"] = buffer
      }
      updateGlobalBufferViews();

      function getTotalMemory() {
          return TOTAL_MEMORY
      }

      function callRuntimeCallbacks(callbacks) {
          while (callbacks.length > 0) {
              var callback = callbacks.shift();
              if (typeof callback == "function") {
                  callback();
                  continue
              }
              var func = callback.func;
              if (typeof func === "number") {
                  if (callback.arg === undefined) {
                      Module["dynCall_v"](func)
                  } else {
                      Module["dynCall_vi"](func, callback.arg)
                  }
              } else {
                  func(callback.arg === undefined ? null : callback.arg)
              }
          }
      }
      var __ATPRERUN__ = [];
      var __ATINIT__ = [];
      var __ATMAIN__ = [];
      var __ATEXIT__ = [];
      var __ATPOSTRUN__ = [];
      var runtimeInitialized = false;
      var runtimeExited = false;

      function preRun() {
          if (Module["preRun"]) {
              if (typeof Module["preRun"] == "function") Module["preRun"] = [Module["preRun"]];
              while (Module["preRun"].length) {
                  addOnPreRun(Module["preRun"].shift())
              }
          }
          callRuntimeCallbacks(__ATPRERUN__)
      }

      function ensureInitRuntime() {
          if (runtimeInitialized) return;
          runtimeInitialized = true;
          callRuntimeCallbacks(__ATINIT__)
      }

      function preMain() {
          callRuntimeCallbacks(__ATMAIN__)
      }

      function exitRuntime() {
          callRuntimeCallbacks(__ATEXIT__);
          runtimeExited = true
      }

      function postRun() {
          if (Module["postRun"]) {
              if (typeof Module["postRun"] == "function") Module["postRun"] = [Module["postRun"]];
              while (Module["postRun"].length) {
                  addOnPostRun(Module["postRun"].shift())
              }
          }
          callRuntimeCallbacks(__ATPOSTRUN__)
      }

      function addOnPreRun(cb) {
          __ATPRERUN__.unshift(cb)
      }

      function addOnPostRun(cb) {
          __ATPOSTRUN__.unshift(cb)
      }

      function writeArrayToMemory(array, buffer) {
          HEAP8.set(array, buffer)
      }
      var runDependencies = 0;
      var runDependencyWatcher = null;
      var dependenciesFulfilled = null;

      function addRunDependency(id) {
          runDependencies++;
          if (Module["monitorRunDependencies"]) {
              Module["monitorRunDependencies"](runDependencies)
          }
      }

      function removeRunDependency(id) {
          runDependencies--;
          if (Module["monitorRunDependencies"]) {
              Module["monitorRunDependencies"](runDependencies)
          }
          if (runDependencies == 0) {
              if (runDependencyWatcher !== null) {
                  clearInterval(runDependencyWatcher);
                  runDependencyWatcher = null
              }
              if (dependenciesFulfilled) {
                  var callback = dependenciesFulfilled;
                  dependenciesFulfilled = null;
                  callback()
              }
          }
      }
      Module["preloadedImages"] = {};
      Module["preloadedAudios"] = {};
      var dataURIPrefix = "data:application/octet-stream;base64,";

      function isDataURI(filename) {
          return String.prototype.startsWith ? filename.startsWith(dataURIPrefix) : filename.indexOf(dataURIPrefix) === 0
      }

      function integrateWasmJS() {
          var wasmTextFile = "BRFv4_JS_TK101018_v4.1.0_trial.wast";
          var wasmBinaryFile = "BRFv4_JS_TK101018_v4.1.0_trial.wasm";
          var asmjsCodeFile = "BRFv4_JS_TK101018_v4.1.0_trial.temp.asm.js";
          if (typeof Module["locateFile"] === "function") {
              if (!isDataURI(wasmTextFile)) {
                  wasmTextFile = Module["locateFile"](wasmTextFile)
              }
              if (!isDataURI(wasmBinaryFile)) {
                  wasmBinaryFile = Module["locateFile"](wasmBinaryFile)
              }
              if (!isDataURI(asmjsCodeFile)) {
                  asmjsCodeFile = Module["locateFile"](asmjsCodeFile)
              }
          }
          var wasmPageSize = 64 * 1024;
          var info = {
              "global": null,
              "env": null,
              "asm2wasm": asm2wasmImports,
              "parent": Module
          };
          var exports = null;

          function mergeMemory(newBuffer) {
              var oldBuffer = Module["buffer"];
              if (newBuffer.byteLength < oldBuffer.byteLength) {
                  err("the new buffer in mergeMemory is smaller than the previous one. in native wasm, we should grow memory here")
              }
              var oldView = new Int8Array(oldBuffer);
              var newView = new Int8Array(newBuffer);
              newView.set(oldView);
              updateGlobalBuffer(newBuffer);
              updateGlobalBufferViews()
          }

          function fixImports(imports) {
              return imports
          }

          function getBinary() {
              try {
                  if (Module["wasmBinary"]) {
                      return new Uint8Array(Module["wasmBinary"])
                  }
                  if (Module["readBinary"]) {
                      return Module["readBinary"](wasmBinaryFile)
                  } else {
                      throw "on the web, we need the wasm binary to be preloaded and set on Module['wasmBinary']. emcc.py will do that for you when generating HTML (but not JS)"
                  }
              } catch (err) {
                  abort(err)
              }
          }

          function getBinaryPromise() {
              if (!Module["wasmBinary"] && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && typeof fetch === "function") {
                  return fetch(wasmBinaryFile, {
                      credentials: "same-origin"
                  }).then((function(response) {
                      if (!response["ok"]) {
                          throw "failed to load wasm binary file at '" + wasmBinaryFile + "'"
                      }
                      return response["arrayBuffer"]()
                  })).catch((function() {
                      return getBinary()
                  }))
              }
              return new Promise((function(resolve, reject) {
                  resolve(getBinary())
              }))
          }

          function doNativeWasm(global, env, providedBuffer) {
              if (typeof WebAssembly !== "object") {
                  err("no native wasm support detected");
                  return false
              }
              if (!(Module["wasmMemory"] instanceof WebAssembly.Memory)) {
                  err("no native wasm Memory in use");
                  return false
              }
              env["memory"] = Module["wasmMemory"];
              info["global"] = {
                  "NaN": NaN,
                  "Infinity": Infinity
              };
              info["global.Math"] = Math;
              info["env"] = env;

              function receiveInstance(instance, module) {
                  exports = instance.exports;
                  if (exports.memory) mergeMemory(exports.memory);
                  Module["asm"] = exports;
                  Module["usingWasm"] = true;
                  removeRunDependency("wasm-instantiate")
              }
              addRunDependency("wasm-instantiate");
              if (Module["instantiateWasm"]) {
                  try {
                      return Module["instantiateWasm"](info, receiveInstance)
                  } catch (e) {
                      err("Module.instantiateWasm callback failed with error: " + e);
                      return false
                  }
              }

              function receiveInstantiatedSource(output) {
                  receiveInstance(output["instance"], output["module"])
              }

              function instantiateArrayBuffer(receiver) {
                  getBinaryPromise().then((function(binary) {
                      return WebAssembly.instantiate(binary, info)
                  })).then(receiver).catch((function(reason) {
                      err("failed to asynchronously prepare wasm: " + reason);
                      abort(reason)
                  }))
              }
              if (!Module["wasmBinary"] && typeof WebAssembly.instantiateStreaming === "function" && !isDataURI(wasmBinaryFile) && typeof fetch === "function") {
                  WebAssembly.instantiateStreaming(fetch(wasmBinaryFile, {
                      credentials: "same-origin"
                  }), info).then(receiveInstantiatedSource).catch((function(reason) {
                      err("wasm streaming compile failed: " + reason);
                      err("falling back to ArrayBuffer instantiation");
                      instantiateArrayBuffer(receiveInstantiatedSource)
                  }))
              } else {
                  instantiateArrayBuffer(receiveInstantiatedSource)
              }
              return {}
          }
          Module["asmPreload"] = Module["asm"];
          var asmjsReallocBuffer = Module["reallocBuffer"];
          var wasmReallocBuffer = (function(size) {
              var PAGE_MULTIPLE = Module["usingWasm"] ? WASM_PAGE_SIZE : ASMJS_PAGE_SIZE;
              size = alignUp(size, PAGE_MULTIPLE);
              var old = Module["buffer"];
              var oldSize = old.byteLength;
              if (Module["usingWasm"]) {
                  try {
                      var result = Module["wasmMemory"].grow((size - oldSize) / wasmPageSize);
                      if (result !== (-1 | 0)) {
                          return Module["buffer"] = Module["wasmMemory"].buffer
                      } else {
                          return null
                      }
                  } catch (e) {
                      return null
                  }
              }
          });
          Module["reallocBuffer"] = (function(size) {
              if (finalMethod === "asmjs") {
                  return asmjsReallocBuffer(size)
              } else {
                  return wasmReallocBuffer(size)
              }
          });
          var finalMethod = "";
          Module["asm"] = (function(global, env, providedBuffer) {
              env = fixImports(env);
              if (!env["table"]) {
                  var TABLE_SIZE = Module["wasmTableSize"];
                  if (TABLE_SIZE === undefined) TABLE_SIZE = 1024;
                  var MAX_TABLE_SIZE = Module["wasmMaxTableSize"];
                  if (typeof WebAssembly === "object" && typeof WebAssembly.Table === "function") {
                      if (MAX_TABLE_SIZE !== undefined) {
                          env["table"] = new WebAssembly.Table({
                              "initial": TABLE_SIZE,
                              "maximum": MAX_TABLE_SIZE,
                              "element": "anyfunc"
                          })
                      } else {
                          env["table"] = new WebAssembly.Table({
                              "initial": TABLE_SIZE,
                              element: "anyfunc"
                          })
                      }
                  } else {
                      env["table"] = new Array(TABLE_SIZE)
                  }
                  Module["wasmTable"] = env["table"]
              }
              if (!env["memoryBase"]) {
                  env["memoryBase"] = Module["STATIC_BASE"]
              }
              if (!env["tableBase"]) {
                  env["tableBase"] = 0
              }
              var exports;
              exports = doNativeWasm(global, env, providedBuffer);
              assert(exports, "no binaryen method succeeded.");
              return exports
          })
      }
      integrateWasmJS();
      var ASM_CONSTS = [(function($0) {
          eval(brfv4["Module"].Pointer_stringify($0))
      }), (function($0, $1, $2, $3, $4, $5, $6, $7, $8, $9) {
          return brfv4["Module"].ok(brfv4["Module"], $0, $1, $2, $3, $4, $5, $6, $7, $8, $9)
      }), (function() {
          brfv4.onBRFv4Loaded()
      }), (function() {
          brfv4.onBRFv4Initialized()
      })];

      function _emscripten_asm_const_i(code) {
          return ASM_CONSTS[code]()
      }

      function _emscripten_asm_const_ii(code, a0) {
          return ASM_CONSTS[code](a0)
      }

      function _emscripten_asm_const_iiiiiiiiiii(code, a0, a1, a2, a3, a4, a5, a6, a7, a8, a9) {
          return ASM_CONSTS[code](a0, a1, a2, a3, a4, a5, a6, a7, a8, a9)
      }
      STATIC_BASE = GLOBAL_BASE;
      STATICTOP = STATIC_BASE + 8650672;
      __ATINIT__.push({
          func: (function() {
              __GLOBAL__I_000101()
          })
      }, {
          func: (function() {
              __GLOBAL__sub_I_BRFManagerJS_cpp()
          })
      }, {
          func: (function() {
              __GLOBAL__sub_I_iostream_cpp()
          })
      });
      var STATIC_BUMP = 8650672;
      Module["STATIC_BASE"] = STATIC_BASE;
      Module["STATIC_BUMP"] = STATIC_BUMP;
      STATICTOP += 16;

      function ___assert_fail(condition, filename, line, func) {
          abort("Assertion failed: " + Pointer_stringify(condition) + ", at: " + [filename ? Pointer_stringify(filename) : "unknown filename", line, func ? Pointer_stringify(func) : "unknown function"])
      }

      function ___cxa_pure_virtual() {
          ABORT = true;
          throw "Pure virtual function called!"
      }

      function ___cxa_uncaught_exception() {
          return !!__ZSt18uncaught_exceptionv.uncaught_exception
      }

      function ___lock() {}
      var ERRNO_CODES = {
          EPERM: 1,
          ENOENT: 2,
          ESRCH: 3,
          EINTR: 4,
          EIO: 5,
          ENXIO: 6,
          E2BIG: 7,
          ENOEXEC: 8,
          EBADF: 9,
          ECHILD: 10,
          EAGAIN: 11,
          EWOULDBLOCK: 11,
          ENOMEM: 12,
          EACCES: 13,
          EFAULT: 14,
          ENOTBLK: 15,
          EBUSY: 16,
          EEXIST: 17,
          EXDEV: 18,
          ENODEV: 19,
          ENOTDIR: 20,
          EISDIR: 21,
          EINVAL: 22,
          ENFILE: 23,
          EMFILE: 24,
          ENOTTY: 25,
          ETXTBSY: 26,
          EFBIG: 27,
          ENOSPC: 28,
          ESPIPE: 29,
          EROFS: 30,
          EMLINK: 31,
          EPIPE: 32,
          EDOM: 33,
          ERANGE: 34,
          ENOMSG: 42,
          EIDRM: 43,
          ECHRNG: 44,
          EL2NSYNC: 45,
          EL3HLT: 46,
          EL3RST: 47,
          ELNRNG: 48,
          EUNATCH: 49,
          ENOCSI: 50,
          EL2HLT: 51,
          EDEADLK: 35,
          ENOLCK: 37,
          EBADE: 52,
          EBADR: 53,
          EXFULL: 54,
          ENOANO: 55,
          EBADRQC: 56,
          EBADSLT: 57,
          EDEADLOCK: 35,
          EBFONT: 59,
          ENOSTR: 60,
          ENODATA: 61,
          ETIME: 62,
          ENOSR: 63,
          ENONET: 64,
          ENOPKG: 65,
          EREMOTE: 66,
          ENOLINK: 67,
          EADV: 68,
          ESRMNT: 69,
          ECOMM: 70,
          EPROTO: 71,
          EMULTIHOP: 72,
          EDOTDOT: 73,
          EBADMSG: 74,
          ENOTUNIQ: 76,
          EBADFD: 77,
          EREMCHG: 78,
          ELIBACC: 79,
          ELIBBAD: 80,
          ELIBSCN: 81,
          ELIBMAX: 82,
          ELIBEXEC: 83,
          ENOSYS: 38,
          ENOTEMPTY: 39,
          ENAMETOOLONG: 36,
          ELOOP: 40,
          EOPNOTSUPP: 95,
          EPFNOSUPPORT: 96,
          ECONNRESET: 104,
          ENOBUFS: 105,
          EAFNOSUPPORT: 97,
          EPROTOTYPE: 91,
          ENOTSOCK: 88,
          ENOPROTOOPT: 92,
          ESHUTDOWN: 108,
          ECONNREFUSED: 111,
          EADDRINUSE: 98,
          ECONNABORTED: 103,
          ENETUNREACH: 101,
          ENETDOWN: 100,
          ETIMEDOUT: 110,
          EHOSTDOWN: 112,
          EHOSTUNREACH: 113,
          EINPROGRESS: 115,
          EALREADY: 114,
          EDESTADDRREQ: 89,
          EMSGSIZE: 90,
          EPROTONOSUPPORT: 93,
          ESOCKTNOSUPPORT: 94,
          EADDRNOTAVAIL: 99,
          ENETRESET: 102,
          EISCONN: 106,
          ENOTCONN: 107,
          ETOOMANYREFS: 109,
          EUSERS: 87,
          EDQUOT: 122,
          ESTALE: 116,
          ENOTSUP: 95,
          ENOMEDIUM: 123,
          EILSEQ: 84,
          EOVERFLOW: 75,
          ECANCELED: 125,
          ENOTRECOVERABLE: 131,
          EOWNERDEAD: 130,
          ESTRPIPE: 86
      };

      function ___setErrNo(value) {
          if (Module["___errno_location"]) HEAP32[Module["___errno_location"]() >> 2] = value;
          return value
      }

      function ___map_file(pathname, size) {
          ___setErrNo(ERRNO_CODES.EPERM);
          return -1
      }
      var SYSCALLS = {
          varargs: 0,
          get: (function(varargs) {
              SYSCALLS.varargs += 4;
              var ret = HEAP32[SYSCALLS.varargs - 4 >> 2];
              return ret
          }),
          getStr: (function() {
              var ret = Pointer_stringify(SYSCALLS.get());
              return ret
          }),
          get64: (function() {
              var low = SYSCALLS.get(),
                  high = SYSCALLS.get();
              if (low >= 0) assert(high === 0);
              else assert(high === -1);
              return low
          }),
          getZero: (function() {
              assert(SYSCALLS.get() === 0)
          })
      };

      function ___syscall140(which, varargs) {
          SYSCALLS.varargs = varargs;
          try {
              var stream = SYSCALLS.getStreamFromFD(),
                  offset_high = SYSCALLS.get(),
                  offset_low = SYSCALLS.get(),
                  result = SYSCALLS.get(),
                  whence = SYSCALLS.get();
              var offset = offset_low;
              FS.llseek(stream, offset, whence);
              HEAP32[result >> 2] = stream.position;
              if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null;
              return 0
          } catch (e) {
              if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
              return -e.errno
          }
      }

      function ___syscall145(which, varargs) {
          SYSCALLS.varargs = varargs;
          try {
              var stream = SYSCALLS.getStreamFromFD(),
                  iov = SYSCALLS.get(),
                  iovcnt = SYSCALLS.get();
              return SYSCALLS.doReadv(stream, iov, iovcnt)
          } catch (e) {
              if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
              return -e.errno
          }
      }

      function ___syscall146(which, varargs) {
          SYSCALLS.varargs = varargs;
          try {
              var stream = SYSCALLS.get(),
                  iov = SYSCALLS.get(),
                  iovcnt = SYSCALLS.get();
              var ret = 0;
              if (!___syscall146.buffers) {
                  ___syscall146.buffers = [null, [],
                      []
                  ];
                  ___syscall146.printChar = (function(stream, curr) {
                      var buffer = ___syscall146.buffers[stream];
                      assert(buffer);
                      if (curr === 0 || curr === 10) {
                          (stream === 1 ? out : err)(UTF8ArrayToString(buffer, 0));
                          buffer.length = 0
                      } else {
                          buffer.push(curr)
                      }
                  })
              }
              for (var i = 0; i < iovcnt; i++) {
                  var ptr = HEAP32[iov + i * 8 >> 2];
                  var len = HEAP32[iov + (i * 8 + 4) >> 2];
                  for (var j = 0; j < len; j++) {
                      ___syscall146.printChar(stream, HEAPU8[ptr + j])
                  }
                  ret += len
              }
              return ret
          } catch (e) {
              if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
              return -e.errno
          }
      }

      function ___syscall54(which, varargs) {
          SYSCALLS.varargs = varargs;
          try {
              return 0
          } catch (e) {
              if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
              return -e.errno
          }
      }

      function ___syscall6(which, varargs) {
          SYSCALLS.varargs = varargs;
          try {
              var stream = SYSCALLS.getStreamFromFD();
              FS.close(stream);
              return 0
          } catch (e) {
              if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
              return -e.errno
          }
      }

      function ___syscall91(which, varargs) {
          SYSCALLS.varargs = varargs;
          try {
              var addr = SYSCALLS.get(),
                  len = SYSCALLS.get();
              var info = SYSCALLS.mappings[addr];
              if (!info) return 0;
              if (len === info.len) {
                  var stream = FS.getStream(info.fd);
                  SYSCALLS.doMsync(addr, stream, len, info.flags);
                  FS.munmap(stream);
                  SYSCALLS.mappings[addr] = null;
                  if (info.allocated) {
                      _free(info.malloc)
                  }
              }
              return 0
          } catch (e) {
              if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
              return -e.errno
          }
      }

      function ___unlock() {}

      function _abort() {
          Module["abort"]()
      }
      var ENV = {};

      function _getenv(name) {
          if (name === 0) return 0;
          name = Pointer_stringify(name);
          if (!ENV.hasOwnProperty(name)) return 0;
          if (_getenv.ret) _free(_getenv.ret);
          _getenv.ret = allocateUTF8(ENV[name]);
          return _getenv.ret
      }

      function _llvm_stackrestore(p) {
          var self = _llvm_stacksave;
          var ret = self.LLVM_SAVEDSTACKS[p];
          self.LLVM_SAVEDSTACKS.splice(p, 1);
          stackRestore(ret)
      }

      function _llvm_stacksave() {
          var self = _llvm_stacksave;
          if (!self.LLVM_SAVEDSTACKS) {
              self.LLVM_SAVEDSTACKS = []
          }
          self.LLVM_SAVEDSTACKS.push(stackSave());
          return self.LLVM_SAVEDSTACKS.length - 1
      }

      function _emscripten_memcpy_big(dest, src, num) {
          HEAPU8.set(HEAPU8.subarray(src, src + num), dest);
          return dest
      }

      function _pthread_cond_wait() {
          return 0
      }

      function __isLeapYear(year) {
          return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
      }

      function __arraySum(array, index) {
          var sum = 0;
          for (var i = 0; i <= index; sum += array[i++]);
          return sum
      }
      var __MONTH_DAYS_LEAP = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      var __MONTH_DAYS_REGULAR = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

      function __addDays(date, days) {
          var newDate = new Date(date.getTime());
          while (days > 0) {
              var leap = __isLeapYear(newDate.getFullYear());
              var currentMonth = newDate.getMonth();
              var daysInCurrentMonth = (leap ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR)[currentMonth];
              if (days > daysInCurrentMonth - newDate.getDate()) {
                  days -= daysInCurrentMonth - newDate.getDate() + 1;
                  newDate.setDate(1);
                  if (currentMonth < 11) {
                      newDate.setMonth(currentMonth + 1)
                  } else {
                      newDate.setMonth(0);
                      newDate.setFullYear(newDate.getFullYear() + 1)
                  }
              } else {
                  newDate.setDate(newDate.getDate() + days);
                  return newDate
              }
          }
          return newDate
      }

      function _strftime(s, maxsize, format, tm) {
          var tm_zone = HEAP32[tm + 40 >> 2];
          var date = {
              tm_sec: HEAP32[tm >> 2],
              tm_min: HEAP32[tm + 4 >> 2],
              tm_hour: HEAP32[tm + 8 >> 2],
              tm_mday: HEAP32[tm + 12 >> 2],
              tm_mon: HEAP32[tm + 16 >> 2],
              tm_year: HEAP32[tm + 20 >> 2],
              tm_wday: HEAP32[tm + 24 >> 2],
              tm_yday: HEAP32[tm + 28 >> 2],
              tm_isdst: HEAP32[tm + 32 >> 2],
              tm_gmtoff: HEAP32[tm + 36 >> 2],
              tm_zone: tm_zone ? Pointer_stringify(tm_zone) : ""
          };
          var pattern = Pointer_stringify(format);
          var EXPANSION_RULES_1 = {
              "%c": "%a %b %d %H:%M:%S %Y",
              "%D": "%m/%d/%y",
              "%F": "%Y-%m-%d",
              "%h": "%b",
              "%r": "%I:%M:%S %p",
              "%R": "%H:%M",
              "%T": "%H:%M:%S",
              "%x": "%m/%d/%y",
              "%X": "%H:%M:%S"
          };
          for (var rule in EXPANSION_RULES_1) {
              pattern = pattern.replace(new RegExp(rule, "g"), EXPANSION_RULES_1[rule])
          }
          var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
          var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

          function leadingSomething(value, digits, character) {
              var str = typeof value === "number" ? value.toString() : value || "";
              while (str.length < digits) {
                  str = character[0] + str
              }
              return str
          }

          function leadingNulls(value, digits) {
              return leadingSomething(value, digits, "0")
          }

          function compareByDay(date1, date2) {
              function sgn(value) {
                  return value < 0 ? -1 : value > 0 ? 1 : 0
              }
              var compare;
              if ((compare = sgn(date1.getFullYear() - date2.getFullYear())) === 0) {
                  if ((compare = sgn(date1.getMonth() - date2.getMonth())) === 0) {
                      compare = sgn(date1.getDate() - date2.getDate())
                  }
              }
              return compare
          }

          function getFirstWeekStartDate(janFourth) {
              switch (janFourth.getDay()) {
                  case 0:
                      return new Date(janFourth.getFullYear() - 1, 11, 29);
                  case 1:
                      return janFourth;
                  case 2:
                      return new Date(janFourth.getFullYear(), 0, 3);
                  case 3:
                      return new Date(janFourth.getFullYear(), 0, 2);
                  case 4:
                      return new Date(janFourth.getFullYear(), 0, 1);
                  case 5:
                      return new Date(janFourth.getFullYear() - 1, 11, 31);
                  case 6:
                      return new Date(janFourth.getFullYear() - 1, 11, 30)
              }
          }

          function getWeekBasedYear(date) {
              var thisDate = __addDays(new Date(date.tm_year + 1900, 0, 1), date.tm_yday);
              var janFourthThisYear = new Date(thisDate.getFullYear(), 0, 4);
              var janFourthNextYear = new Date(thisDate.getFullYear() + 1, 0, 4);
              var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
              var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
              if (compareByDay(firstWeekStartThisYear, thisDate) <= 0) {
                  if (compareByDay(firstWeekStartNextYear, thisDate) <= 0) {
                      return thisDate.getFullYear() + 1
                  } else {
                      return thisDate.getFullYear()
                  }
              } else {
                  return thisDate.getFullYear() - 1
              }
          }
          var EXPANSION_RULES_2 = {
              "%a": (function(date) {
                  return WEEKDAYS[date.tm_wday].substring(0, 3)
              }),
              "%A": (function(date) {
                  return WEEKDAYS[date.tm_wday]
              }),
              "%b": (function(date) {
                  return MONTHS[date.tm_mon].substring(0, 3)
              }),
              "%B": (function(date) {
                  return MONTHS[date.tm_mon]
              }),
              "%C": (function(date) {
                  var year = date.tm_year + 1900;
                  return leadingNulls(year / 100 | 0, 2)
              }),
              "%d": (function(date) {
                  return leadingNulls(date.tm_mday, 2)
              }),
              "%e": (function(date) {
                  return leadingSomething(date.tm_mday, 2, " ")
              }),
              "%g": (function(date) {
                  return getWeekBasedYear(date).toString().substring(2)
              }),
              "%G": (function(date) {
                  return getWeekBasedYear(date)
              }),
              "%H": (function(date) {
                  return leadingNulls(date.tm_hour, 2)
              }),
              "%I": (function(date) {
                  var twelveHour = date.tm_hour;
                  if (twelveHour == 0) twelveHour = 12;
                  else if (twelveHour > 12) twelveHour -= 12;
                  return leadingNulls(twelveHour, 2)
              }),
              "%j": (function(date) {
                  return leadingNulls(date.tm_mday + __arraySum(__isLeapYear(date.tm_year + 1900) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, date.tm_mon - 1), 3)
              }),
              "%m": (function(date) {
                  return leadingNulls(date.tm_mon + 1, 2)
              }),
              "%M": (function(date) {
                  return leadingNulls(date.tm_min, 2)
              }),
              "%n": (function() {
                  return "\n"
              }),
              "%p": (function(date) {
                  if (date.tm_hour >= 0 && date.tm_hour < 12) {
                      return "AM"
                  } else {
                      return "PM"
                  }
              }),
              "%S": (function(date) {
                  return leadingNulls(date.tm_sec, 2)
              }),
              "%t": (function() {
                  return "\t"
              }),
              "%u": (function(date) {
                  var day = new Date(date.tm_year + 1900, date.tm_mon + 1, date.tm_mday, 0, 0, 0, 0);
                  return day.getDay() || 7
              }),
              "%U": (function(date) {
                  var janFirst = new Date(date.tm_year + 1900, 0, 1);
                  var firstSunday = janFirst.getDay() === 0 ? janFirst : __addDays(janFirst, 7 - janFirst.getDay());
                  var endDate = new Date(date.tm_year + 1900, date.tm_mon, date.tm_mday);
                  if (compareByDay(firstSunday, endDate) < 0) {
                      var februaryFirstUntilEndMonth = __arraySum(__isLeapYear(endDate.getFullYear()) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, endDate.getMonth() - 1) - 31;
                      var firstSundayUntilEndJanuary = 31 - firstSunday.getDate();
                      var days = firstSundayUntilEndJanuary + februaryFirstUntilEndMonth + endDate.getDate();
                      return leadingNulls(Math.ceil(days / 7), 2)
                  }
                  return compareByDay(firstSunday, janFirst) === 0 ? "01" : "00"
              }),
              "%V": (function(date) {
                  var janFourthThisYear = new Date(date.tm_year + 1900, 0, 4);
                  var janFourthNextYear = new Date(date.tm_year + 1901, 0, 4);
                  var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
                  var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
                  var endDate = __addDays(new Date(date.tm_year + 1900, 0, 1), date.tm_yday);
                  if (compareByDay(endDate, firstWeekStartThisYear) < 0) {
                      return "53"
                  }
                  if (compareByDay(firstWeekStartNextYear, endDate) <= 0) {
                      return "01"
                  }
                  var daysDifference;
                  if (firstWeekStartThisYear.getFullYear() < date.tm_year + 1900) {
                      daysDifference = date.tm_yday + 32 - firstWeekStartThisYear.getDate()
                  } else {
                      daysDifference = date.tm_yday + 1 - firstWeekStartThisYear.getDate()
                  }
                  return leadingNulls(Math.ceil(daysDifference / 7), 2)
              }),
              "%w": (function(date) {
                  var day = new Date(date.tm_year + 1900, date.tm_mon + 1, date.tm_mday, 0, 0, 0, 0);
                  return day.getDay()
              }),
              "%W": (function(date) {
                  var janFirst = new Date(date.tm_year, 0, 1);
                  var firstMonday = janFirst.getDay() === 1 ? janFirst : __addDays(janFirst, janFirst.getDay() === 0 ? 1 : 7 - janFirst.getDay() + 1);
                  var endDate = new Date(date.tm_year + 1900, date.tm_mon, date.tm_mday);
                  if (compareByDay(firstMonday, endDate) < 0) {
                      var februaryFirstUntilEndMonth = __arraySum(__isLeapYear(endDate.getFullYear()) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, endDate.getMonth() - 1) - 31;
                      var firstMondayUntilEndJanuary = 31 - firstMonday.getDate();
                      var days = firstMondayUntilEndJanuary + februaryFirstUntilEndMonth + endDate.getDate();
                      return leadingNulls(Math.ceil(days / 7), 2)
                  }
                  return compareByDay(firstMonday, janFirst) === 0 ? "01" : "00"
              }),
              "%y": (function(date) {
                  return (date.tm_year + 1900).toString().substring(2)
              }),
              "%Y": (function(date) {
                  return date.tm_year + 1900
              }),
              "%z": (function(date) {
                  var off = date.tm_gmtoff;
                  var ahead = off >= 0;
                  off = Math.abs(off) / 60;
                  off = off / 60 * 100 + off % 60;
                  return (ahead ? "+" : "-") + String("0000" + off).slice(-4)
              }),
              "%Z": (function(date) {
                  return date.tm_zone
              }),
              "%%": (function() {
                  return "%"
              })
          };
          for (var rule in EXPANSION_RULES_2) {
              if (pattern.indexOf(rule) >= 0) {
                  pattern = pattern.replace(new RegExp(rule, "g"), EXPANSION_RULES_2[rule](date))
              }
          }
          var bytes = intArrayFromString(pattern, false);
          if (bytes.length > maxsize) {
              return 0
          }
          writeArrayToMemory(bytes, s);
          return bytes.length - 1
      }

      function _strftime_l(s, maxsize, format, tm) {
          return _strftime(s, maxsize, format, tm)
      }
      DYNAMICTOP_PTR = staticAlloc(4);
      STACK_BASE = STACKTOP = alignMemory(STATICTOP);
      STACK_MAX = STACK_BASE + TOTAL_STACK;
      DYNAMIC_BASE = alignMemory(STACK_MAX);
      HEAP32[DYNAMICTOP_PTR >> 2] = DYNAMIC_BASE;
      staticSealed = true;

      function intArrayFromString(stringy, dontAddNull, length) {
          var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
          var u8array = new Array(len);
          var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
          if (dontAddNull) u8array.length = numBytesWritten;
          return u8array
      }
      Module["wasmTableSize"] = 714;
      Module["wasmMaxTableSize"] = 714;
      Module.asmGlobalArg = {};
      Module.asmLibraryArg = {
          "abort": abort,
          "enlargeMemory": enlargeMemory,
          "getTotalMemory": getTotalMemory,
          "abortOnCannotGrowMemory": abortOnCannotGrowMemory,
          "___assert_fail": ___assert_fail,
          "___cxa_pure_virtual": ___cxa_pure_virtual,
          "___cxa_uncaught_exception": ___cxa_uncaught_exception,
          "___lock": ___lock,
          "___map_file": ___map_file,
          "___setErrNo": ___setErrNo,
          "___syscall140": ___syscall140,
          "___syscall145": ___syscall145,
          "___syscall146": ___syscall146,
          "___syscall54": ___syscall54,
          "___syscall6": ___syscall6,
          "___syscall91": ___syscall91,
          "___unlock": ___unlock,
          "_abort": _abort,
          "_emscripten_asm_const_i": _emscripten_asm_const_i,
          "_emscripten_asm_const_ii": _emscripten_asm_const_ii,
          "_emscripten_asm_const_iiiiiiiiiii": _emscripten_asm_const_iiiiiiiiiii,
          "_emscripten_memcpy_big": _emscripten_memcpy_big,
          "_getenv": _getenv,
          "_llvm_stackrestore": _llvm_stackrestore,
          "_llvm_stacksave": _llvm_stacksave,
          "_pthread_cond_wait": _pthread_cond_wait,
          "_strftime_l": _strftime_l,
          "DYNAMICTOP_PTR": DYNAMICTOP_PTR,
          "STACKTOP": STACKTOP
      };
      var asm = Module["asm"](Module.asmGlobalArg, Module.asmLibraryArg, buffer);
      Module["asm"] = asm;
      var __GLOBAL__I_000101 = Module["__GLOBAL__I_000101"] = (function() {
          return Module["asm"]["__GLOBAL__I_000101"].apply(null, arguments)
      });
      var __GLOBAL__sub_I_BRFManagerJS_cpp = Module["__GLOBAL__sub_I_BRFManagerJS_cpp"] = (function() {
          return Module["asm"]["__GLOBAL__sub_I_BRFManagerJS_cpp"].apply(null, arguments)
      });
      var __GLOBAL__sub_I_iostream_cpp = Module["__GLOBAL__sub_I_iostream_cpp"] = (function() {
          return Module["asm"]["__GLOBAL__sub_I_iostream_cpp"].apply(null, arguments)
      });
      var __ZSt18uncaught_exceptionv = Module["__ZSt18uncaught_exceptionv"] = (function() {
          return Module["asm"]["__ZSt18uncaught_exceptionv"].apply(null, arguments)
      });
      var __brf_addOpticalFlowPoints = Module["__brf_addOpticalFlowPoints"] = (function() {
          return Module["asm"]["__brf_addOpticalFlowPoints"].apply(null, arguments)
      });
      var __brf_get_allDetectedFaces = Module["__brf_get_allDetectedFaces"] = (function() {
          return Module["asm"]["__brf_get_allDetectedFaces"].apply(null, arguments)
      });
      var __brf_get_allDetectedFaces_length = Module["__brf_get_allDetectedFaces_length"] = (function() {
          return Module["asm"]["__brf_get_allDetectedFaces_length"].apply(null, arguments)
      });
      var __brf_get_face_bounds = Module["__brf_get_face_bounds"] = (function() {
          return Module["asm"]["__brf_get_face_bounds"].apply(null, arguments)
      });
      var __brf_get_face_candideTriangles = Module["__brf_get_face_candideTriangles"] = (function() {
          return Module["asm"]["__brf_get_face_candideTriangles"].apply(null, arguments)
      });
      var __brf_get_face_candideTriangles_length = Module["__brf_get_face_candideTriangles_length"] = (function() {
          return Module["asm"]["__brf_get_face_candideTriangles_length"].apply(null, arguments)
      });
      var __brf_get_face_candideVertices = Module["__brf_get_face_candideVertices"] = (function() {
          return Module["asm"]["__brf_get_face_candideVertices"].apply(null, arguments)
      });
      var __brf_get_face_candideVertices_length = Module["__brf_get_face_candideVertices_length"] = (function() {
          return Module["asm"]["__brf_get_face_candideVertices_length"].apply(null, arguments)
      });
      var __brf_get_face_lastState = Module["__brf_get_face_lastState"] = (function() {
          return Module["asm"]["__brf_get_face_lastState"].apply(null, arguments)
      });
      var __brf_get_face_nextState = Module["__brf_get_face_nextState"] = (function() {
          return Module["asm"]["__brf_get_face_nextState"].apply(null, arguments)
      });
      var __brf_get_face_points = Module["__brf_get_face_points"] = (function() {
          return Module["asm"]["__brf_get_face_points"].apply(null, arguments)
      });
      var __brf_get_face_points_length = Module["__brf_get_face_points_length"] = (function() {
          return Module["asm"]["__brf_get_face_points_length"].apply(null, arguments)
      });
      var __brf_get_face_refRect = Module["__brf_get_face_refRect"] = (function() {
          return Module["asm"]["__brf_get_face_refRect"].apply(null, arguments)
      });
      var __brf_get_face_rotationX = Module["__brf_get_face_rotationX"] = (function() {
          return Module["asm"]["__brf_get_face_rotationX"].apply(null, arguments)
      });
      var __brf_get_face_rotationY = Module["__brf_get_face_rotationY"] = (function() {
          return Module["asm"]["__brf_get_face_rotationY"].apply(null, arguments)
      });
      var __brf_get_face_rotationZ = Module["__brf_get_face_rotationZ"] = (function() {
          return Module["asm"]["__brf_get_face_rotationZ"].apply(null, arguments)
      });
      var __brf_get_face_scale = Module["__brf_get_face_scale"] = (function() {
          return Module["asm"]["__brf_get_face_scale"].apply(null, arguments)
      });
      var __brf_get_face_state = Module["__brf_get_face_state"] = (function() {
          return Module["asm"]["__brf_get_face_state"].apply(null, arguments)
      });
      var __brf_get_face_translationX = Module["__brf_get_face_translationX"] = (function() {
          return Module["asm"]["__brf_get_face_translationX"].apply(null, arguments)
      });
      var __brf_get_face_translationY = Module["__brf_get_face_translationY"] = (function() {
          return Module["asm"]["__brf_get_face_translationY"].apply(null, arguments)
      });
      var __brf_get_face_triangles = Module["__brf_get_face_triangles"] = (function() {
          return Module["asm"]["__brf_get_face_triangles"].apply(null, arguments)
      });
      var __brf_get_face_triangles_length = Module["__brf_get_face_triangles_length"] = (function() {
          return Module["asm"]["__brf_get_face_triangles_length"].apply(null, arguments)
      });
      var __brf_get_face_vertices = Module["__brf_get_face_vertices"] = (function() {
          return Module["asm"]["__brf_get_face_vertices"].apply(null, arguments)
      });
      var __brf_get_face_vertices_length = Module["__brf_get_face_vertices_length"] = (function() {
          return Module["asm"]["__brf_get_face_vertices_length"].apply(null, arguments)
      });
      var __brf_get_faces_length = Module["__brf_get_faces_length"] = (function() {
          return Module["asm"]["__brf_get_faces_length"].apply(null, arguments)
      });
      var __brf_get_mergedDetectedFaces = Module["__brf_get_mergedDetectedFaces"] = (function() {
          return Module["asm"]["__brf_get_mergedDetectedFaces"].apply(null, arguments)
      });
      var __brf_get_mergedDetectedFaces_length = Module["__brf_get_mergedDetectedFaces_length"] = (function() {
          return Module["asm"]["__brf_get_mergedDetectedFaces_length"].apply(null, arguments)
      });
      var __brf_get_mode = Module["__brf_get_mode"] = (function() {
          return Module["asm"]["__brf_get_mode"].apply(null, arguments)
      });
      var __brf_get_opticalFlowCheckPointsValidBeforeTracking = Module["__brf_get_opticalFlowCheckPointsValidBeforeTracking"] = (function() {
          return Module["asm"]["__brf_get_opticalFlowCheckPointsValidBeforeTracking"].apply(null, arguments)
      });
      var __brf_get_opticalFlowPointStates = Module["__brf_get_opticalFlowPointStates"] = (function() {
          return Module["asm"]["__brf_get_opticalFlowPointStates"].apply(null, arguments)
      });
      var __brf_get_opticalFlowPointStates_length = Module["__brf_get_opticalFlowPointStates_length"] = (function() {
          return Module["asm"]["__brf_get_opticalFlowPointStates_length"].apply(null, arguments)
      });
      var __brf_get_opticalFlowPoints = Module["__brf_get_opticalFlowPoints"] = (function() {
          return Module["asm"]["__brf_get_opticalFlowPoints"].apply(null, arguments)
      });
      var __brf_get_opticalFlowPoints_length = Module["__brf_get_opticalFlowPoints_length"] = (function() {
          return Module["asm"]["__brf_get_opticalFlowPoints_length"].apply(null, arguments)
      });
      var __brf_init = Module["__brf_init"] = (function() {
          return Module["asm"]["__brf_init"].apply(null, arguments)
      });
      var __brf_reset = Module["__brf_reset"] = (function() {
          return Module["asm"]["__brf_reset"].apply(null, arguments)
      });
      var __brf_set_faceDetectionParams = Module["__brf_set_faceDetectionParams"] = (function() {
          return Module["asm"]["__brf_set_faceDetectionParams"].apply(null, arguments)
      });
      var __brf_set_faceDetectionRoi = Module["__brf_set_faceDetectionRoi"] = (function() {
          return Module["asm"]["__brf_set_faceDetectionRoi"].apply(null, arguments)
      });
      var __brf_set_faceTrackingResetParams = Module["__brf_set_faceTrackingResetParams"] = (function() {
          return Module["asm"]["__brf_set_faceTrackingResetParams"].apply(null, arguments)
      });
      var __brf_set_faceTrackingStartParams = Module["__brf_set_faceTrackingStartParams"] = (function() {
          return Module["asm"]["__brf_set_faceTrackingStartParams"].apply(null, arguments)
      });
      var __brf_set_mode = Module["__brf_set_mode"] = (function() {
          return Module["asm"]["__brf_set_mode"].apply(null, arguments)
      });
      var __brf_set_numFacesToTrack = Module["__brf_set_numFacesToTrack"] = (function() {
          return Module["asm"]["__brf_set_numFacesToTrack"].apply(null, arguments)
      });
      var __brf_set_opticalFlowCheckPointsValidBeforeTracking = Module["__brf_set_opticalFlowCheckPointsValidBeforeTracking"] = (function() {
          return Module["asm"]["__brf_set_opticalFlowCheckPointsValidBeforeTracking"].apply(null, arguments)
      });
      var __brf_set_opticalFlowParams = Module["__brf_set_opticalFlowParams"] = (function() {
          return Module["asm"]["__brf_set_opticalFlowParams"].apply(null, arguments)
      });
      var __brf_update = Module["__brf_update"] = (function() {
          return Module["asm"]["__brf_update"].apply(null, arguments)
      });
      var _emscripten_replace_memory = Module["_emscripten_replace_memory"] = (function() {
          return Module["asm"]["_emscripten_replace_memory"].apply(null, arguments)
      });
      var _free = Module["_free"] = (function() {
          return Module["asm"]["_free"].apply(null, arguments)
      });
      var _main = Module["_main"] = (function() {
          return Module["asm"]["_main"].apply(null, arguments)
      });
      var _malloc = Module["_malloc"] = (function() {
          return Module["asm"]["_malloc"].apply(null, arguments)
      });
      var stackAlloc = Module["stackAlloc"] = (function() {
          return Module["asm"]["stackAlloc"].apply(null, arguments)
      });
      var stackRestore = Module["stackRestore"] = (function() {
          return Module["asm"]["stackRestore"].apply(null, arguments)
      });
      var stackSave = Module["stackSave"] = (function() {
          return Module["asm"]["stackSave"].apply(null, arguments)
      });
      var dynCall_ii = Module["dynCall_ii"] = (function() {
          return Module["asm"]["dynCall_ii"].apply(null, arguments)
      });
      var dynCall_iii = Module["dynCall_iii"] = (function() {
          return Module["asm"]["dynCall_iii"].apply(null, arguments)
      });
      var dynCall_iiii = Module["dynCall_iiii"] = (function() {
          return Module["asm"]["dynCall_iiii"].apply(null, arguments)
      });
      var dynCall_iiiii = Module["dynCall_iiiii"] = (function() {
          return Module["asm"]["dynCall_iiiii"].apply(null, arguments)
      });
      var dynCall_iiiiid = Module["dynCall_iiiiid"] = (function() {
          return Module["asm"]["dynCall_iiiiid"].apply(null, arguments)
      });
      var dynCall_iiiiii = Module["dynCall_iiiiii"] = (function() {
          return Module["asm"]["dynCall_iiiiii"].apply(null, arguments)
      });
      var dynCall_iiiiiid = Module["dynCall_iiiiiid"] = (function() {
          return Module["asm"]["dynCall_iiiiiid"].apply(null, arguments)
      });
      var dynCall_iiiiiii = Module["dynCall_iiiiiii"] = (function() {
          return Module["asm"]["dynCall_iiiiiii"].apply(null, arguments)
      });
      var dynCall_iiiiiiii = Module["dynCall_iiiiiiii"] = (function() {
          return Module["asm"]["dynCall_iiiiiiii"].apply(null, arguments)
      });
      var dynCall_iiiiiiiii = Module["dynCall_iiiiiiiii"] = (function() {
          return Module["asm"]["dynCall_iiiiiiiii"].apply(null, arguments)
      });
      var dynCall_iiiiij = Module["dynCall_iiiiij"] = (function() {
          return Module["asm"]["dynCall_iiiiij"].apply(null, arguments)
      });
      var dynCall_v = Module["dynCall_v"] = (function() {
          return Module["asm"]["dynCall_v"].apply(null, arguments)
      });
      var dynCall_vi = Module["dynCall_vi"] = (function() {
          return Module["asm"]["dynCall_vi"].apply(null, arguments)
      });
      var dynCall_viddddd = Module["dynCall_viddddd"] = (function() {
          return Module["asm"]["dynCall_viddddd"].apply(null, arguments)
      });
      var dynCall_vii = Module["dynCall_vii"] = (function() {
          return Module["asm"]["dynCall_vii"].apply(null, arguments)
      });
      var dynCall_viii = Module["dynCall_viii"] = (function() {
          return Module["asm"]["dynCall_viii"].apply(null, arguments)
      });
      var dynCall_viiii = Module["dynCall_viiii"] = (function() {
          return Module["asm"]["dynCall_viiii"].apply(null, arguments)
      });
      var dynCall_viiiid = Module["dynCall_viiiid"] = (function() {
          return Module["asm"]["dynCall_viiiid"].apply(null, arguments)
      });
      var dynCall_viiiii = Module["dynCall_viiiii"] = (function() {
          return Module["asm"]["dynCall_viiiii"].apply(null, arguments)
      });
      var dynCall_viiiiii = Module["dynCall_viiiiii"] = (function() {
          return Module["asm"]["dynCall_viiiiii"].apply(null, arguments)
      });
      var dynCall_viijii = Module["dynCall_viijii"] = (function() {
          return Module["asm"]["dynCall_viijii"].apply(null, arguments)
      });
      Module["asm"] = asm;
      Module["cwrap"] = cwrap;
      Module["Pointer_stringify"] = Pointer_stringify;
      Module["stringToUTF32"] = stringToUTF32;
      Module["lengthBytesUTF32"] = lengthBytesUTF32;
      Module["dynCall"] = dynCall;
      Module["then"] = (function(func) {
          if (Module["calledRun"]) {
              func(Module)
          } else {
              var old = Module["onRuntimeInitialized"];
              Module["onRuntimeInitialized"] = (function() {
                  if (old) old();
                  func(Module)
              })
          }
          return Module
      });

      function ExitStatus(status) {
          this.name = "ExitStatus";
          this.message = "Program terminated with exit(" + status + ")";
          this.status = status
      }
      ExitStatus.prototype = new Error;
      ExitStatus.prototype.constructor = ExitStatus;
      var initialStackTop;
      var calledMain = false;
      dependenciesFulfilled = function runCaller() {
          if (!Module["calledRun"]) run();
          if (!Module["calledRun"]) dependenciesFulfilled = runCaller
      };
      Module["callMain"] = function callMain(args) {
          args = args || [];
          ensureInitRuntime();
          var argc = args.length + 1;
          var argv = stackAlloc((argc + 1) * 4);
          HEAP32[argv >> 2] = allocateUTF8OnStack(Module["thisProgram"]);
          for (var i = 1; i < argc; i++) {
              HEAP32[(argv >> 2) + i] = allocateUTF8OnStack(args[i - 1])
          }
          HEAP32[(argv >> 2) + argc] = 0;
          try {
              var ret = Module["_main"](argc, argv, 0);
              exit(ret, true)
          } catch (e) {
              if (e instanceof ExitStatus) {
                  return
              } else if (e == "SimulateInfiniteLoop") {
                  Module["noExitRuntime"] = true;
                  return
              } else {
                  var toLog = e;
                  if (e && typeof e === "object" && e.stack) {
                      toLog = [e, e.stack]
                  }
                  err("exception thrown: " + toLog);
                  Module["quit"](1, e)
              }
          } finally {
              calledMain = true
          }
      };

      function run(args) {
          args = args || Module["arguments"];
          if (runDependencies > 0) {
              return
          }
          preRun();
          if (runDependencies > 0) return;
          if (Module["calledRun"]) return;

          function doRun() {
              if (Module["calledRun"]) return;
              Module["calledRun"] = true;
              if (ABORT) return;
              ensureInitRuntime();
              preMain();
              if (Module["onRuntimeInitialized"]) Module["onRuntimeInitialized"]();
              if (Module["_main"] && shouldRunNow) Module["callMain"](args);
              postRun()
          }
          if (Module["setStatus"]) {
              Module["setStatus"]("Running...");
              setTimeout((function() {
                  setTimeout((function() {
                      Module["setStatus"]("")
                  }), 1);
                  doRun()
              }), 1)
          } else {
              doRun()
          }
      }
      Module["run"] = run;

      function exit(status, implicit) {
          if (implicit && Module["noExitRuntime"] && status === 0) {
              return
          }
          if (Module["noExitRuntime"]) {} else {
              ABORT = true;
              EXITSTATUS = status;
              STACKTOP = initialStackTop;
              exitRuntime();
              if (Module["onExit"]) Module["onExit"](status)
          }
          Module["quit"](status, new ExitStatus(status))
      }

      function abort(what) {
          if (Module["onAbort"]) {
              Module["onAbort"](what)
          }
          if (what !== undefined) {
              out(what);
              err(what);
              what = JSON.stringify(what)
          } else {
              what = ""
          }
          ABORT = true;
          EXITSTATUS = 1;
          throw "abort(" + what + "). Build with -s ASSERTIONS=1 for more info."
      }
      Module["abort"] = abort;
      if (Module["preInit"]) {
          if (typeof Module["preInit"] == "function") Module["preInit"] = [Module["preInit"]];
          while (Module["preInit"].length > 0) {
              Module["preInit"].pop()()
          }
      }
      var shouldRunNow = true;
      if (Module["noInitialRun"]) {
          shouldRunNow = false
      }
      Module["noExitRuntime"] = true;
      run()
      return brfv4SDK;
  };
  if (typeof exports === 'object' && typeof module === 'object')
      module.exports = brfv4SDK;
  else if (typeof define === 'function' && define['amd'])
      define([], function() {
          return brfv4SDK;
      });
  else if (typeof exports === 'object')
      exports["brfv4SDK"] = brfv4SDK;
  (function(lib) {
      lib.defaultValue = function(arg, val) {
          return typeof arg !== "undefined" ? arg : val
      };
      lib.Point = function(_x, _y) {
          this.x = lib.defaultValue(_x, 0);
          this.y = lib.defaultValue(_y, 0)
      };
      lib.Point.prototype.setTo = function(_x, _y) {
          this.x = lib.defaultValue(_x, 0);
          this.y = lib.defaultValue(_y, 0)
      };
      lib.Rectangle = function(_x, _y, _width, _height) {
          this.x = lib.defaultValue(_x, 0);
          this.y = lib.defaultValue(_y, 0);
          this.width = lib.defaultValue(_width, 0);
          this.height = lib.defaultValue(_height, 0)
      };
      lib.Rectangle.prototype.setTo = function(_x,
          _y, _width, _height) {
          this.x = lib.defaultValue(_x, 0);
          this.y = lib.defaultValue(_y, 0);
          this.width = lib.defaultValue(_width, 0);
          this.height = lib.defaultValue(_height, 0)
      };
      lib.BRFMode = {
          FACE_DETECTION: "mode_face_detection",
          FACE_TRACKING: "mode_face_tracking",
          POINT_TRACKING: "mode_point_tracking"
      };
      lib.BRFState = {
          FACE_DETECTION: "state_face_detection",
          FACE_TRACKING_START: "state_face_tracking_start",
          FACE_TRACKING: "state_face_tracking",
          RESET: "state_reset"
      };
      lib.BRFFace = function() {
          this.lastState = lib.BRFState.RESET;
          this.state =
              lib.BRFState.RESET;
          this.nextState = lib.BRFState.RESET;
          this.vertices = [];
          this.triangles = [];
          this.points = [];
          this.bounds = new lib.Rectangle(0, 0, 0, 0);
          this.refRect = new lib.Rectangle(0, 0, 0, 0);
          this.candideVertices = [];
          this.candideTriangles = [];
          this.scale = 1;
          this.translationX = 0;
          this.translationY = 0;
          this.rotationX = 0;
          this.rotationY = 0;
          this.rotationZ = 0
      }
  })(brfv4);
  (function(lib) {
      lib.sdkReady = false;
      lib.sdkInitialized = false;
      lib.onBRFv4Loaded = function() {
          lib.sdkReady = true
      };
      lib.onBRFv4Initialized = function() {
          lib.sdkInitialized = true
      };
      lib.BRFv4Context = function() {
          var _this = this;
          var _void = null;
          var _string = "string";
          var _int = "number";
          var _float = "number";
          var _uint8Array = "number";
          var _float32Array = "number";
          var _boolean = "number";
          var _noArgs = [];
          var _float32Bytes = (new Float32Array(1)).BYTES_PER_ELEMENT;
          var _uint8Bytes = (new Uint8Array(1)).BYTES_PER_ELEMENT;
          var _lib = lib;
          var retrieveFloat32ArrayAndMap =
              function(cFunc, mapFunc, dataLength, resultArray) {
                  var numBytes = dataLength * _float32Bytes;
                  var dataPtr = _lib["_malloc"](numBytes);
                  var i = cFunc(dataPtr);
                  mapFunc(resultArray, new Float32Array(_lib["HEAPU8"].buffer, dataPtr, dataLength));
                  _lib["_free"](dataPtr)
              };
          var retrieveFloat32ArrayAndMapIndex = function(cFunc, index, mapFunc, dataLength, resultArray) {
              var numBytes = dataLength * _float32Bytes;
              var dataPtr = _lib["_malloc"](numBytes);
              var i = cFunc(index, dataPtr);
              mapFunc(resultArray, new Float32Array(_lib["HEAPU8"].buffer, dataPtr,
                  dataLength));
              _lib["_free"](dataPtr)
          };
          var retrieveUint8ArrayAndMap = function(cFunc, mapFunc, dataLength, resultArray) {
              var numBytes = dataLength * _uint8Bytes;
              var dataPtr = _lib["_malloc"](numBytes);
              cFunc(dataPtr);
              mapFunc(resultArray, new Uint8Array(_lib["HEAPU8"].buffer, dataPtr, dataLength));
              _lib["_free"](dataPtr)
          };
          var retrieveUint8ArrayAndMapIndex = function(cFunc, index, mapFunc, dataLength, resultArray) {
              var numBytes = dataLength * _uint8Bytes;
              var dataPtr = _lib["_malloc"](numBytes);
              cFunc(index, dataPtr);
              mapFunc(resultArray,
                  new Uint8Array(_lib["HEAPU8"].buffer, dataPtr, dataLength));
              _lib["_free"](dataPtr)
          };
          var clearArray = function(array) {
              array.splice(0, array.length)
          };
          var mapUint8DataToArray = function(array, data) {
              var i = 0;
              var l = data.length;
              if (array.length > l) array.splice(l, array.length - l);
              else array.length = l;
              while (i < l) {
                  array[i] = data[i];
                  ++i
              }
          };
          var mapUint8DataToBooleanArray = function(array, data) {
              var i = 0;
              var l = data.length;
              if (array.length > l) array.splice(l, array.length - l);
              else array.length = l;
              while (i < l) {
                  array[i] = data[i] == 1;
                  ++i
              }
          };
          var mapFloat32DataToArray = function(array, data) {
              var i = 0;
              var l = data.length;
              if (array.length > l) array.splice(l, array.length - l);
              else array.length = l;
              while (i < l) {
                  array[i] = data[i];
                  ++i
              }
          };
          var mapFloat32DataToRectangle = function(rect, data) {
              rect.x = data[0];
              rect.y = data[1];
              rect.width = data[2];
              rect.height = data[3]
          };
          var mapFloat32DataToRectangleArray = function(array, data) {
              var i = 0;
              var k = 0;
              var l = data.length / 4;
              if (array.length > l) array.splice(l, array.length - l);
              if (array.length < l) {
                  i = array.length;
                  while (i < l) {
                      array[i] = new lib.Rectangle(0,
                          0, 0, 0);
                      ++i
                  }
              }
              i = 0;
              var rect;
              while (i < l) {
                  rect = array[i];
                  rect.x = data[k++];
                  rect.y = data[k++];
                  rect.width = data[k++];
                  rect.height = data[k++];
                  ++i
              }
          };
          var mapFloat32DataToPointArray = function(array, data) {
              var i = 0;
              var k = 0;
              var l = data.length / 2;
              if (array.length > l) array.splice(l, array.length - l);
              if (array.length < l) {
                  i = array.length;
                  while (i < l) {
                      array[i] = new lib.Point(0, 0);
                      ++i
                  }
              }
              i = 0;
              var p;
              while (i < l) {
                  p = array[i];
                  p.x = data[k++];
                  p.y = data[k++];
                  ++i
              }
          };
          var mapPointArrayToFloat32Data = function(pointArray, data) {
              var i = 0;
              var k = 0;
              var l = pointArray.length;
              var p;
              while (i < l) {
                  p = pointArray[i];
                  data[k++] = p.x;
                  data[k++] = p.y;
                  ++i
              }
          };
          var resizeFacesArray = function(array, numFaces) {
              var i = 0;
              var l = numFaces;
              if (array.length > l) array.splice(l, array.length - l);
              if (array.length < l) {
                  i = array.length;
                  while (i < l) {
                      array[i] = new lib.BRFFace;
                      ++i
                  }
              }
          };
          var _brf_c_init = _lib.cwrap("_brf_init", _void, [_int, _int, _int, _int, _int, _int, _string]);
          _this.imageDataPtr = null;
          _this.init = function(srcWidth, srcHeight, imageRoiX, imageRoiY, imageRoiWidth, imageRoiHeight, appId) {
              if (_this.imageDataPtr != null) {
                  _lib["_free"](_this.imageDataPtr);
                  _this.imageDataPtr = null
              }
              _brf_c_init(srcWidth, srcHeight, imageRoiX, imageRoiY, imageRoiWidth, imageRoiHeight, appId)
          };
          var _brf_c_update = _lib.cwrap("_brf_update", _int, [_uint8Array]);
          _this.update = function(imageData) {
              var dataPtr = _this.imageDataPtr;
              if (dataPtr == null) {
                  var numBytes = imageData.length * _uint8Bytes;
                  dataPtr = _lib["_malloc"](numBytes);
                  _this.imageDataPtr = dataPtr
              }
              _lib["HEAPU8"].set(imageData, dataPtr);
              var i = _brf_c_update(dataPtr)
          };
          var _brf_c_reset = _lib.cwrap("_brf_reset", _void, _noArgs);
          _this.reset = function() {
              _brf_c_reset()
          };
          var _brf_c_get_mode = _lib.cwrap("_brf_get_mode", _string, _noArgs);
          _this.getMode = function() {
              return _brf_c_get_mode()
          };
          var _brf_c_set_mode = _lib.cwrap("_brf_set_mode", _void, [_string]);
          _this.setMode = function(mode) {
              _brf_c_set_mode(mode)
          };
          var _brf_c_set_faceDetectionParams = _lib.cwrap("_brf_set_faceDetectionParams", _void, [_int, _int, _int, _int]);
          _this.setFaceDetectionParams = function(minFaceSize, maxFaceSize, stepSize, minMergeNeighbors) {
              _brf_c_set_faceDetectionParams(minFaceSize, maxFaceSize, stepSize, minMergeNeighbors)
          };
          var _brf_c_set_faceDetectionRoi = _lib.cwrap("_brf_set_faceDetectionRoi", _void, [_int, _int, _int, _int]);
          _this.setFaceDetectionRoi = function(fdRoiX, fdRoiY, fdRoiWidth, fdRoiHeight) {
              _brf_c_set_faceDetectionRoi(fdRoiX, fdRoiY, fdRoiWidth, fdRoiHeight)
          };
          var _brf_c_get_allDetectedFaces_length = _lib.cwrap("_brf_get_allDetectedFaces_length", _int, _noArgs);
          var _brf_c_get_allDetectedFaces = _lib.cwrap("_brf_get_allDetectedFaces", _int, [_float32Array]);
          _this.getAllDetectedFaces = function(result) {
              var dataLength = _brf_c_get_allDetectedFaces_length() *
                  4;
              if (dataLength <= 0) clearArray(result);
              else retrieveFloat32ArrayAndMap(_brf_c_get_allDetectedFaces, mapFloat32DataToRectangleArray, dataLength, result)
          };
          var _brf_c_get_mergedDetectedFaces_length = _lib.cwrap("_brf_get_mergedDetectedFaces_length", _int, _noArgs);
          var _brf_c_get_mergedDetectedFaces = _lib.cwrap("_brf_get_mergedDetectedFaces", _int, [_float32Array]);
          _this.getMergedDetectedFaces = function(result) {
              var dataLength = _brf_c_get_mergedDetectedFaces_length() * 4;
              if (dataLength <= 0) clearArray(result);
              else retrieveFloat32ArrayAndMap(_brf_c_get_mergedDetectedFaces,
                  mapFloat32DataToRectangleArray, dataLength, result)
          };
          var _brf_c_set_numFacesToTrack = _lib.cwrap("_brf_set_numFacesToTrack", _void, [_int]);
          _this.setNumFacesToTrack = function(numFaces) {
              _brf_c_set_numFacesToTrack(numFaces)
          };
          var _brf_c_set_faceTrackingStartParams = _lib.cwrap("_brf_set_faceTrackingStartParams", _void, [_float, _float, _float, _float, _float]);
          _this.setFaceTrackingStartParams = function(startMinFaceWidth, startMaxFaceWidth, startRotationX, startRotationY, startRotationZ) {
              _brf_c_set_faceTrackingStartParams(startMinFaceWidth,
                  startMaxFaceWidth, startRotationX, startRotationY, startRotationZ)
          };
          var _brf_c_set_faceTrackingResetParams = _lib.cwrap("_brf_set_faceTrackingResetParams", _void, [_float, _float, _float, _float, _float]);
          _this.setFaceTrackingResetParams = function(resetMinFaceWidth, resetMaxFaceWidth, resetRotationX, resetRotationY, resetRotationZ) {
              _brf_c_set_faceTrackingResetParams(resetMinFaceWidth, resetMaxFaceWidth, resetRotationX, resetRotationY, resetRotationZ)
          };
          var _brf_c_get_faces_length = _lib.cwrap("_brf_get_faces_length", _int,
              _noArgs);
          var _brf_c_get_face_lastState = _lib.cwrap("_brf_get_face_lastState", _string, [_int]);
          var _brf_c_get_face_state = _lib.cwrap("_brf_get_face_state", _string, [_int]);
          var _brf_c_get_face_nextState = _lib.cwrap("_brf_get_face_nextState", _string, [_int]);
          var _brf_c_get_face_vertices_length = _lib.cwrap("_brf_get_face_vertices_length", _int, [_int]);
          var _brf_c_get_face_vertices = _lib.cwrap("_brf_get_face_vertices", _int, [_int, _float32Array]);
          var _brf_c_get_face_triangles_length = _lib.cwrap("_brf_get_face_triangles_length",
              _int, [_int]);
          var _brf_c_get_face_triangles = _lib.cwrap("_brf_get_face_triangles", _int, [_int, _uint8Array]);
          var _brf_c_get_face_points_length = _lib.cwrap("_brf_get_face_points_length", _int, [_int]);
          var _brf_c_get_face_points = _lib.cwrap("_brf_get_face_points", _int, [_int, _float32Array]);
          var _brf_c_get_face_bounds = _lib.cwrap("_brf_get_face_bounds", _int, [_int, _float32Array]);
          var _brf_c_get_face_refRect = _lib.cwrap("_brf_get_face_refRect", _int, [_int, _float32Array]);
          var _brf_c_get_face_candideVertices_length =
              _lib.cwrap("_brf_get_face_candideVertices_length", _int, [_int]);
          var _brf_c_get_face_candideVertices = _lib.cwrap("_brf_get_face_candideVertices", _int, [_int, _float32Array]);
          var _brf_c_get_face_candideTriangles_length = _lib.cwrap("_brf_get_face_candideTriangles_length", _int, [_int]);
          var _brf_c_get_face_candideTriangles = _lib.cwrap("_brf_get_face_candideTriangles", _int, [_int, _uint8Array]);
          var _brf_c_get_face_scale = _lib.cwrap("_brf_get_face_scale", _float, [_int]);
          var _brf_c_get_face_translationX = _lib.cwrap("_brf_get_face_translationX",
              _float, [_int]);
          var _brf_c_get_face_translationY = _lib.cwrap("_brf_get_face_translationY", _float, [_int]);
          var _brf_c_get_face_rotationX = _lib.cwrap("_brf_get_face_rotationX", _float, [_int]);
          var _brf_c_get_face_rotationY = _lib.cwrap("_brf_get_face_rotationY", _float, [_int]);
          var _brf_c_get_face_rotationZ = _lib.cwrap("_brf_get_face_rotationZ", _float, [_int]);
          _this.getFaces = function(result) {
              var numFaces = _brf_c_get_faces_length();
              resizeFacesArray(result, numFaces);
              var dataLength = 0;
              for (var fi = 0; fi < numFaces; fi++) {
                  var face =
                      result[fi];
                  face.lastState = _brf_c_get_face_lastState(fi);
                  face.state = _brf_c_get_face_state(fi);
                  face.nextState = _brf_c_get_face_nextState(fi);
                  dataLength = _brf_c_get_face_vertices_length(fi);
                  if (dataLength <= 0) clearArray(face.vertices);
                  else retrieveFloat32ArrayAndMapIndex(_brf_c_get_face_vertices, fi, mapFloat32DataToArray, dataLength, face.vertices);
                  if (face.triangles.length == 0) {
                      dataLength = _brf_c_get_face_triangles_length(fi);
                      if (dataLength <= 0) clearArray(face.triangles);
                      else retrieveUint8ArrayAndMapIndex(_brf_c_get_face_triangles,
                          fi, mapUint8DataToArray, dataLength, face.triangles)
                  }
                  dataLength = _brf_c_get_face_points_length(fi) * 2;
                  if (dataLength <= 0) clearArray(face.points);
                  else retrieveFloat32ArrayAndMapIndex(_brf_c_get_face_points, fi, mapFloat32DataToPointArray, dataLength, face.points);
                  dataLength = 4 * _float32Bytes;
                  retrieveFloat32ArrayAndMapIndex(_brf_c_get_face_bounds, fi, mapFloat32DataToRectangle, dataLength, face.bounds);
                  retrieveFloat32ArrayAndMapIndex(_brf_c_get_face_refRect, fi, mapFloat32DataToRectangle, dataLength, face.refRect);
                  dataLength =
                      _brf_c_get_face_candideVertices_length(fi);
                  if (dataLength <= 0) clearArray(face.candideVertices);
                  else retrieveFloat32ArrayAndMapIndex(_brf_c_get_face_candideVertices, fi, mapFloat32DataToArray, dataLength, face.candideVertices);
                  if (face.candideTriangles.length == 0) {
                      dataLength = _brf_c_get_face_candideTriangles_length(fi);
                      if (dataLength <= 0) clearArray(face.candideTriangles);
                      else retrieveUint8ArrayAndMapIndex(_brf_c_get_face_candideTriangles, fi, mapUint8DataToArray, dataLength, face.candideTriangles)
                  }
                  face.scale = _brf_c_get_face_scale(fi);
                  face.translationX = _brf_c_get_face_translationX(fi);
                  face.translationY = _brf_c_get_face_translationY(fi);
                  face.rotationX = _brf_c_get_face_rotationX(fi);
                  face.rotationY = _brf_c_get_face_rotationY(fi);
                  face.rotationZ = _brf_c_get_face_rotationZ(fi)
              }
          };
          var _brf_c_set_opticalFlowParams = _lib.cwrap("_brf_set_opticalFlowParams", _void, [_int, _int, _int, _float]);
          _this.setOpticalFlowParams = function(patchSize, numLevels, numIterations, error) {
              _brf_c_set_opticalFlowParams(patchSize, numLevels, numIterations, error)
          };
          var _brf_c_addOpticalFlowPoints =
              _lib.cwrap("_brf_addOpticalFlowPoints", _int, [_float32Array, _int]);
          _this.addOpticalFlowPoints = function(pointArray) {
              var numPointsToAdd = pointArray.length;
              var dataLength = numPointsToAdd * 2;
              var data = new Float32Array(dataLength);
              mapPointArrayToFloat32Data(pointArray, data);
              var numBytes = data.length * _float32Bytes;
              var dataPtr = _lib["_malloc"](numBytes);
              var dataHeap = new Uint8Array(_lib["HEAPU8"].buffer, dataPtr, numBytes);
              dataHeap.set(new Uint8Array(data.buffer));
              var i = _brf_c_addOpticalFlowPoints(dataPtr, dataLength);
              _lib["_free"](dataPtr)
          };
          var _brf_c_get_opticalFlowPoints_length = _lib.cwrap("_brf_get_opticalFlowPoints_length", _int, _noArgs);
          var _brf_c_get_opticalFlowPoints = _lib.cwrap("_brf_get_opticalFlowPoints", _int, [_float32Array]);
          _this.getOpticalFlowPoints = function(result) {
              var dataLength = _brf_c_get_opticalFlowPoints_length() * 2;
              if (dataLength <= 0) clearArray(result);
              else retrieveFloat32ArrayAndMap(_brf_c_get_opticalFlowPoints, mapFloat32DataToPointArray, dataLength, result)
          };
          var _brf_c_get_opticalFlowPointStates_length =
              _lib.cwrap("_brf_get_opticalFlowPointStates_length", _int, _noArgs);
          var _brf_c_get_opticalFlowPointStates = _lib.cwrap("_brf_get_opticalFlowPointStates", _int, [_uint8Array]);
          _this.getOpticalFlowPointStates = function(result) {
              var dataLength = _brf_c_get_opticalFlowPointStates_length();
              if (dataLength <= 0) clearArray(result);
              else retrieveUint8ArrayAndMap(_brf_c_get_opticalFlowPointStates, mapUint8DataToBooleanArray, dataLength, result)
          };
          var _brf_c_get_opticalFlowCheckPointsValidBeforeTracking = _lib.cwrap("_brf_get_opticalFlowCheckPointsValidBeforeTracking",
              _boolean, _noArgs);
          _this.getOpticalFlowCheckPointsValidBeforeTracking = function() {
              return _brf_c_get_opticalFlowCheckPointsValidBeforeTracking() == 1
          };
          var _brf_c_set_opticalFlowCheckPointsValidBeforeTracking = _lib.cwrap("_brf_set_opticalFlowCheckPointsValidBeforeTracking", _void, [_boolean]);
          _this.setOpticalFlowCheckPointsValidBeforeTracking = function(value) {
              value = value == true ? 1 : 0;
              _brf_c_set_opticalFlowCheckPointsValidBeforeTracking(value)
          }
      };
      lib["Module"] = brfv4SDK(lib);
      lib.BRFv4ContextManager = function() {
          var _this =
              this;
          var _context = new lib.BRFv4Context;
          var _allDetectedFaces = [];
          var _mergedDetectedFaces = [];
          var _faces = [];
          var _pointsToTrack = [];
          var _pointStates = [];
          var fetchResults = function() {
              _context.getOpticalFlowPoints(_pointsToTrack);
              _context.getOpticalFlowPointStates(_pointStates);
              _context.getAllDetectedFaces(_allDetectedFaces);
              _context.getMergedDetectedFaces(_mergedDetectedFaces);
              _context.getFaces(_faces)
          };
          _this.init = function(src, imageRoi, appId) {
              if (src == null) throw 'BRFManager init is missing the first parameter "src : BitmapData". ' +
                  "Refer to the SDK examples for the correct usage.";
              if (imageRoi == null) throw 'BRFManager constructor is missing the second parameter "imageRoi : Rectangle". ' + "Refer to the SDK examples for the correct usage.";
              if (appId == null || appId.length < 8) throw 'BRFManager constructor is missing the third parameter "appId : String (length >= 8)". ' + "Refer to the SDK examples for the correct usage.";
              if (_context != null) _context.init(src.width, src.height, imageRoi.x, imageRoi.y, imageRoi.width, imageRoi.height, appId)
          };
          _this.update =
              function(imageData) {
                  if (_context == null) throw "BRFv4Context is not available. Call init first.";
                  if (imageData == null) throw "BRFManager.update: BitmapData must NOT be null.";
                  _context.update(imageData);
                  fetchResults()
              };
          _this.reset = function() {
              if (_context == null) throw "BRFv4Context is not available. Call init first.";
              _context.reset();
              fetchResults()
          };
          _this.getMode = function() {
              if (_context == null) throw "BRFv4Context is not available. Call init first.";
              return _context.getMode()
          };
          _this.setMode = function(mode) {
              if (_context ==
                  null) throw "BRFv4Context is not available. Call init first.";
              _context.setMode(mode)
          };
          _this.setFaceDetectionParams = function(minFaceSize, maxFaceSize, stepSize, minMergeNeighbors) {
              if (_context == null) throw "BRFv4Context is not available. Call init first.";
              _context.setFaceDetectionParams(minFaceSize, maxFaceSize, stepSize, minMergeNeighbors)
          };
          _this.setFaceDetectionRoi = function(roi) {
              if (_context == null) throw "BRFv4Context is not available. Call init first.";
              _context.setFaceDetectionRoi(roi.x, roi.y, roi.width, roi.height)
          };
          _this.getAllDetectedFaces = function() {
              return _allDetectedFaces
          };
          _this.getMergedDetectedFaces = function() {
              return _mergedDetectedFaces
          };
          _this.setNumFacesToTrack = function(numFaces) {
              if (_context == null) throw "BRFv4Context is not available. Call init first.";
              _context.setNumFacesToTrack(numFaces)
          };
          _this.setFaceTrackingStartParams = function(startMinFaceWidth, startMaxFaceWidth, startRotationX, startRotationY, startRotationZ) {
              if (_context == null) throw "BRFv4Context is not available. Call init first.";
              _context.setFaceTrackingStartParams(startMinFaceWidth,
                  startMaxFaceWidth, startRotationX, startRotationY, startRotationZ)
          };
          _this.setFaceTrackingResetParams = function(resetMinFaceWidth, resetMaxFaceWidth, resetRotationX, resetRotationY, resetRotationZ) {
              if (_context == null) throw "BRFv4Context is not available. Call init first.";
              _context.setFaceTrackingResetParams(resetMinFaceWidth, resetMaxFaceWidth, resetRotationX, resetRotationY, resetRotationZ)
          };
          _this.getFaces = function() {
              return _faces
          };
          _this.setOpticalFlowParams = function(patchSize, numLevels, numIterations, error) {
              if (_context ==
                  null) throw "BRFv4Context is not available. Call init first.";
              _context.setOpticalFlowParams(patchSize, numLevels, numIterations, error)
          };
          _this.addOpticalFlowPoints = function(pointArray) {
              if (_context == null) throw "BRFv4Context is not available. Call init first.";
              _context.addOpticalFlowPoints(pointArray);
              fetchResults()
          };
          _this.getOpticalFlowPoints = function() {
              return _pointsToTrack
          };
          _this.getOpticalFlowPointStates = function() {
              return _pointStates
          };
          _this.getOpticalFlowCheckPointsValidBeforeTracking = function() {
              if (_context ==
                  null) throw "BRFv4Context is not available. Call init first.";
              return _context.getOpticalFlowCheckPointsValidBeforeTracking()
          };
          _this.setOpticalFlowCheckPointsValidBeforeTracking = function(value) {
              if (_context == null) throw "BRFv4Context is not available. Call init first.";
              _context.setOpticalFlowCheckPointsValidBeforeTracking(value)
          }
      };
      lib.BRFManager = lib.BRFv4ContextManager
  })(brfv4);
} // initializeBRF