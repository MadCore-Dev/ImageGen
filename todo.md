Act as a senior frontend developer. I am building a local AI Image Generation UI connecting to ComfyUI. I need you to rewrite my `selectStyle()` and `selectModel()` JavaScript functions to automatically lock in the fastest, highest-quality generation settings. 

When a user clicks a "Style" chip, it should automatically select the mapped model. 
When a model is selected, it must automatically snap the Steps and CFG sliders to the EXACT optimal values below, and dynamically update the `max` properties of the sliders so the user cannot accidentally over-bake the image (which causes 2-hour wait times).

Here are the strict rules and fixed values you must implement:

### TABLE 1: Model Optimal Parameters (Fastest + Best Quality)
| Model Architecture (data-type) | Example Models | Fixed Steps | Fixed CFG | Slider Max Steps | Slider Max CFG |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **gguf** (FLUX Schnell) | `flux` | **4** | **1.0** | 8 | 3.0 |
| **sdxl_lightning** (Distilled) | `DreamShaperXL_Lightning.safetensors` | **6** | **2.0** | 10 | 5.0 |
| **sdxl** (Standard XL) | `Juggernaut-XL_v9.safetensors`, `ponyDiffusionV6XL.safetensors` | **25** | **6.0** | 40 | 12.0 |
| **sd15** (Standard 1.5) | `AnyLoRA_noVae_fp16-pruned.safetensors`, `DreamShaper_8_pruned.safetensors` | **20** | **7.0** | 40 | 15.0 |

### TABLE 2: Style to Model Mapping
| Style ID | Target Model to Auto-Select |
| :--- | :--- |
| `photorealistic` | `Juggernaut-XL_v9.safetensors` |
| `portrait` | `Juggernaut-XL_v9.safetensors` |
| `anime` | `ponyDiffusionV6XL.safetensors` |
| `pixel` | `flux` |
| `cartoon` | `DreamShaper_8_pruned.safetensors` |
| `fantasy` | `AnyLoRA_noVae_fp16-pruned.safetensors` |
| `scifi` | `DreamShaperXL_Lightning.safetensors` |
| `3d` | `DreamShaperXL_Lightning.safetensors` |
| `nsfw` | `ponyDiffusionV6XL.safetensors` |

### Requirements for the JS Code:
1. Write the Javascript logic to map these arrays/objects cleanly.
2. In `selectStyle(chip)`, after setting the active style, programmatically trigger `selectModel()` for the mapped target model.
3. In `selectModel(chip)`, update the DOM elements `stepsSlider` and `cfgSlider` with the `value` AND `max` properties from Table 1 based on the `chip.dataset.type`. 
4. Update the visual text displays (`stepsVal` and `cfgVal`) to match the newly snapped slider values.
5. Provide the complete code for these two functions so I can drop them into my UI script.