<?php

class Sns_Toronto_Model_System_Config_Source_ListMenuStyles
{
	public function toOptionArray()
	{
		return array(
			//array('value'=>'base', 'label'=>Mage::helper('toronto')->__('Base')),
			array('value'=>'mega', 'label'=>Mage::helper('toronto')->__('Mega'))
		);
	}
}
