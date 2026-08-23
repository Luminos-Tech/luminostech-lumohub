#include "lumo_runtime.h"

/* All optional hardware and network features are temporarily disabled. */
static const lumo_feature_config_t FEATURES = {0};

void app_main(void)
{
    lumo_runtime_start(&FEATURES);
}
